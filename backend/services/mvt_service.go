package services

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"bike-map-backend/config"
	"bike-map-backend/entities"
)

// CacheEntry represents a cached tile with version and response data
type CacheEntry struct {
	Version  int64  // Tile-specific version number
	Response []byte // MVT tile data
}

// MVTService handles MVT generation from PostGIS with per-tile memory caching
type MVTService struct {
	db         *sql.DB
	config     *config.Config
	cache      map[string]*CacheEntry // Memory cache: "z-x-y" -> CacheEntry
	cacheMutex sync.RWMutex           // Thread-safe access to cache
	minZoom    int
	maxZoom    int
}

// NewMVTService creates a new MVT service instance
func NewMVTService(cfg *config.Config) (*MVTService, error) {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.Database.Host, cfg.Database.Port, cfg.Database.User, cfg.Database.Password, cfg.Database.Database)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostGIS: %w", err)
	}

	// Set max connections
	db.SetMaxIdleConns(10)
	db.SetMaxOpenConns(30)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping PostGIS: %w", err)
	}

	return &MVTService{
		db:      db,
		config:  cfg,
		cache:   make(map[string]*CacheEntry),
		minZoom: 6,
		maxZoom: 18,
	}, nil
}

// Close closes the database connection
func (m *MVTService) Close() error {
	return m.db.Close()
}

func (m *MVTService) GetMinZoom() int {
	return m.minZoom
}

func (m *MVTService) GetMaxZoom() int {
	return m.maxZoom
}

// InvalidateTilesForBBox invalidates cache entries for tiles that intersect with a trail's bounding box
func (m *MVTService) InvalidateTilesForBBox(trailBBox entities.BoundingBox) {

	cacheStats := m.GetCacheStats()
	log.Println("Cache stats before invalidation:")
	log.Println(cacheStats)

	m.cacheMutex.Lock()
	defer m.cacheMutex.Unlock()

	invalidatedCount := 0

	// Calculate and invalidate tiles for each zoom level
	for zoom := m.minZoom; zoom <= m.maxZoom; zoom++ {
		// Get tile coordinate ranges for this bounding box at current zoom level
		minX, minY, maxX, maxY := m.boundingBoxToTileRange(trailBBox, zoom)

		// Generate specific tile keys in the calculated range
		for x := minX; x <= maxX; x++ {
			for y := minY; y <= maxY; y++ {
				tileKey := fmt.Sprintf("%d-%d-%d", zoom, x, y)
				if _, exists := m.cache[tileKey]; exists {
					delete(m.cache, tileKey)
					invalidatedCount++
				}
			}
		}
	}

	if invalidatedCount > 0 {
		log.Printf("Invalidated %d cached tiles for bbox update (zoom %d-%d)", invalidatedCount, m.minZoom, m.maxZoom)
	}
}

// InvalidateAllCache clears the entire cache (for major data changes)
func (m *MVTService) InvalidateAllCache() {
	m.cacheMutex.Lock()
	defer m.cacheMutex.Unlock()

	cacheSize := len(m.cache)
	m.cache = make(map[string]*CacheEntry)
	log.Printf("Invalidated entire MVT cache (%d tiles)", cacheSize)
}

// GenerateTrailsMVT generates MVT for trails with caching support
func (m *MVTService) GenerateTrailsMVT(z, x, y int) ([]byte, error) {
	if z < m.minZoom {
		return []byte{}, nil
	}
	if z > m.maxZoom {
		return []byte{}, nil
	}

	// Create cache key
	tileKey := fmt.Sprintf("%d-%d-%d", z, x, y)

	// Check cache first
	m.cacheMutex.RLock()
	if entry, exists := m.cache[tileKey]; exists {
		m.cacheMutex.RUnlock()
		return entry.Response, nil
	}
	m.cacheMutex.RUnlock()

	// Cache miss - generate tile

	// Calculate tile bounds
	bounds := m.calculateTileBounds(z, x, y)

	// Determine simplification tolerance based on zoom level
	tolerance := m.calculateSimplificationTolerance(z)

	// Generate MVT using PostGIS ST_AsMVT function
	var query string
	var args []interface{}

	if tolerance > 0 {
		query = `
			WITH mvt_geom AS (
				SELECT 
					id,
					name,
					description,
					level,
					CASE 
						WHEN tags IS NOT NULL THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(tags)), ',')
						ELSE NULL
					END as tags,
					owner_id,
					created_at,
					updated_at,
					gpx_file,
					-- Phase 1: Bounding box coordinates
					ST_XMin(bbox) as bbox_west,
					ST_YMin(bbox) as bbox_south,
					ST_XMax(bbox) as bbox_east,
					ST_YMax(bbox) as bbox_north,
					-- Phase 2: Start/End points
					ST_X(ST_StartPoint(geom)) as start_lng,
					ST_Y(ST_StartPoint(geom)) as start_lat,
					ST_X(ST_EndPoint(geom)) as end_lng,
					ST_Y(ST_EndPoint(geom)) as end_lat,
					-- Phase 2: Trail statistics
					distance_m,
					-- Phase 2: Elevation data (extract key metrics)
					COALESCE((elevation_data->>'gain')::REAL, 0) as elevation_gain_meters,
					COALESCE((elevation_data->>'loss')::REAL, 0) as elevation_loss_meters,
					-- Phase 2: Min/Max elevation from profile data
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(SELECT MIN((value->>'elevation')::REAL) FROM jsonb_array_elements(elevation_data->'profile') AS value)
						ELSE NULL
					END as min_elevation_meters,
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(SELECT MAX((value->>'elevation')::REAL) FROM jsonb_array_elements(elevation_data->'profile') AS value)
						ELSE NULL
					END as max_elevation_meters,
					-- Start and end elevation
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(elevation_data->'profile'->0->>'elevation')::REAL
						ELSE NULL
					END as elevation_start_meters,
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(elevation_data->'profile'->-1->>'elevation')::REAL
						ELSE NULL
					END as elevation_end_meters,
					-- Engagement data
					rating_average,
					rating_count,
					comment_count,
					-- Ridden status
					ridden,
					-- Simplify geometry based on zoom level
					ST_AsMVTGeom(
						ST_Transform(
							ST_Simplify(geom, $5),
							3857
						),
						ST_MakeEnvelope($1, $2, $3, $4, 3857),
						4096,
						64,
						true
					) AS geom
				FROM trails
				WHERE geom IS NOT NULL
					AND ST_Intersects(
						geom,
						ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 3857), 4326)
					)
			)
			SELECT ST_AsMVT(mvt_geom.*, 'trails') 
			FROM mvt_geom
			WHERE geom IS NOT NULL;`
		args = []interface{}{bounds.XMin, bounds.YMin, bounds.XMax, bounds.YMax, tolerance}
	} else {
		query = `
			WITH mvt_geom AS (
				SELECT 
					id,
					name,
					description,
					level,
					CASE 
						WHEN tags IS NOT NULL THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(tags)), ',')
						ELSE NULL
					END as tags,
					owner_id,
					created_at,
					updated_at,
					gpx_file,
					-- Phase 1: Bounding box coordinates
					ST_XMin(bbox) as bbox_west,
					ST_YMin(bbox) as bbox_south,
					ST_XMax(bbox) as bbox_east,
					ST_YMax(bbox) as bbox_north,
					-- Phase 2: Start/End points
					ST_X(ST_StartPoint(geom)) as start_lng,
					ST_Y(ST_StartPoint(geom)) as start_lat,
					ST_X(ST_EndPoint(geom)) as end_lng,
					ST_Y(ST_EndPoint(geom)) as end_lat,
					-- Phase 2: Trail statistics
					distance_m,
					-- Phase 2: Elevation data (extract key metrics)
					COALESCE((elevation_data->>'gain')::REAL, 0) as elevation_gain_meters,
					COALESCE((elevation_data->>'loss')::REAL, 0) as elevation_loss_meters,
					-- Phase 2: Min/Max elevation from profile data
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(SELECT MIN((value->>'elevation')::REAL) FROM jsonb_array_elements(elevation_data->'profile') AS value)
						ELSE NULL
					END as min_elevation_meters,
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(SELECT MAX((value->>'elevation')::REAL) FROM jsonb_array_elements(elevation_data->'profile') AS value)
						ELSE NULL
					END as max_elevation_meters,
					-- Start and end elevation
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(elevation_data->'profile'->0->>'elevation')::REAL
						ELSE NULL
					END as elevation_start_meters,
					CASE 
						WHEN elevation_data->'profile' IS NOT NULL AND jsonb_array_length(elevation_data->'profile') > 0 THEN
							(elevation_data->'profile'->-1->>'elevation')::REAL
						ELSE NULL
					END as elevation_end_meters,
					-- Engagement data
					rating_average,
					rating_count,
					comment_count,
					-- Ridden status
					ridden,
					-- No simplification
					ST_AsMVTGeom(
						ST_Transform(geom, 3857),
						ST_MakeEnvelope($1, $2, $3, $4, 3857),
						4096,
						64,
						true
					) AS geom
				FROM trails
				WHERE geom IS NOT NULL
					AND ST_Intersects(
						geom,
						ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 3857), 4326)
					)
			)
			SELECT ST_AsMVT(mvt_geom.*, 'trails') 
			FROM mvt_geom
			WHERE geom IS NOT NULL;`
		args = []interface{}{bounds.XMin, bounds.YMin, bounds.XMax, bounds.YMax}
	}

	var mvtData []byte
	err := m.db.QueryRow(query, args...).Scan(&mvtData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate MVT: %w", err)
	}

	// Store in cache with current timestamp as version
	cacheEntry := &CacheEntry{
		Version:  time.Now().UnixNano(),
		Response: mvtData,
	}

	m.cacheMutex.Lock()
	m.cache[tileKey] = cacheEntry
	m.cacheMutex.Unlock()

	return mvtData, nil
}

// calculateTileBounds calculates the bounds of a tile in Web Mercator projection
func (m *MVTService) calculateTileBounds(z, x, y int) entities.TileBounds {
	// Web Mercator bounds: -20037508.34 to 20037508.34
	const worldSize = 20037508.34278924

	tileSize := worldSize * 2.0 / float64(int64(1)<<uint(z))

	return entities.TileBounds{
		XMin: -worldSize + float64(x)*tileSize,
		YMin: worldSize - float64(y+1)*tileSize,
		XMax: -worldSize + float64(x+1)*tileSize,
		YMax: worldSize - float64(y)*tileSize,
	}
}

// calculateSimplificationTolerance returns geometry simplification tolerance based on zoom level
func (m *MVTService) calculateSimplificationTolerance(z int) float64 {
	// More aggressive simplification at lower zoom levels
	switch {
	case z <= 8:
		return 0.05 // Very simplified for country/regional view
	case z <= 10:
		return 0.01 // Simplified for regional view
	case z <= 11:
		return 0.001 // Moderate simplification for city view
	case z <= 12:
		return 0.0005 // Light simplification for neighborhood view
	default:
		return 0 // No simplification for detailed view
	}
}

// latLngToTileCoords converts lat/lng coordinates to tile coordinates at given zoom level
func (m *MVTService) latLngToTileCoords(lat, lng float64, zoom int) (int, int) {
	// Clamp latitude to valid Web Mercator range
	if lat > 85.0511 {
		lat = 85.0511
	}
	if lat < -85.0511 {
		lat = -85.0511
	}

	// Convert to radians
	latRad := lat * math.Pi / 180.0

	// Calculate tile coordinates using standard Web Mercator formulas
	n := math.Pow(2.0, float64(zoom))
	x := int((lng + 180.0) / 360.0 * n)
	y := int((1.0 - math.Asinh(math.Tan(latRad))/math.Pi) / 2.0 * n)

	// Clamp to valid tile ranges
	if x < 0 {
		x = 0
	}
	if x >= int(n) {
		x = int(n) - 1
	}
	if y < 0 {
		y = 0
	}
	if y >= int(n) {
		y = int(n) - 1
	}

	return x, y
}

// boundingBoxToTileRange calculates tile coordinate ranges for a bounding box at given zoom level
func (m *MVTService) boundingBoxToTileRange(bbox entities.BoundingBox, zoom int) (minX, minY, maxX, maxY int) {
	// Validate bbox is not degenerate
	if bbox.North <= bbox.South || bbox.East <= bbox.West {
		// Return empty range that will be skipped in loops
		return 0, 0, -1, -1
	}

	// Convert bounding box corners to tile coordinates
	// Note: North = max lat, South = min lat, East = max lng, West = min lng
	minX, maxY = m.latLngToTileCoords(bbox.South, bbox.West, zoom) // Bottom-left corner
	maxX, minY = m.latLngToTileCoords(bbox.North, bbox.East, zoom) // Top-right corner

	// Ensure proper ordering (min <= max) - should not be needed with valid bbox, but safety check
	if minX > maxX {
		minX, maxX = maxX, minX
	}
	if minY > maxY {
		minY, maxY = maxY, minY
	}

	return minX, minY, maxX, maxY
}

// GetTileCacheVersion returns the cache version for a specific tile
func (m *MVTService) GetTileCacheVersion(z, x, y int) string {
	tileKey := fmt.Sprintf("%d-%d-%d", z, x, y)

	m.cacheMutex.RLock()
	defer m.cacheMutex.RUnlock()

	if entry, exists := m.cache[tileKey]; exists {
		return fmt.Sprintf("%d", entry.Version)
	}

	// Return timestamp-based version for uncached tiles
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// GetCacheStats returns cache statistics for monitoring
func (m *MVTService) GetCacheStats() map[string]interface{} {
	m.cacheMutex.RLock()
	defer m.cacheMutex.RUnlock()

	return map[string]interface{}{
		"total_tiles":        len(m.cache),
		"memory_usage_bytes": m.calculateCacheSize(),
	}
}

// calculateCacheSize estimates memory usage of cache
func (m *MVTService) calculateCacheSize() int64 {
	var totalSize int64
	for _, entry := range m.cache {
		totalSize += int64(len(entry.Response)) + 8 // 8 bytes for Version int64
	}
	return totalSize
}
