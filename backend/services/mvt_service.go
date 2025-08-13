package services

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
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
}

// NewMVTService creates a new MVT service instance
func NewMVTService(cfg *config.Config) (*MVTService, error) {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.Database.Host, cfg.Database.Port, cfg.Database.User, cfg.Database.Password, cfg.Database.Database)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostGIS: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping PostGIS: %w", err)
	}

	return &MVTService{
		db:     db,
		config: cfg,
		cache:  make(map[string]*CacheEntry),
	}, nil
}

// Close closes the database connection
func (m *MVTService) Close() error {
	return m.db.Close()
}

// InvalidateTilesForTrail invalidates cache entries for tiles that intersect with a trail's bounding box
func (m *MVTService) InvalidateTilesForTrail(trailBBox entities.BoundingBox) {
	m.InvalidateAllCache() //TODO only invalidate the trail's tiles
	// 	m.cacheMutex.Lock()
	// 	defer m.cacheMutex.Unlock()

	// invalidatedCount := 0

	// // Find tiles that might intersect with the trail's bounding box
	// // For efficiency, we invalidate tiles across multiple zoom levels
	// for tileKey := range m.cache {
	// 	// Parse tile coordinates from key "z-x-y"
	// 	var z, x, y int
	// 	if _, err := fmt.Sscanf(tileKey, "%d-%d-%d", &z, &x, &y); err != nil {
	// 		continue
	// 	}

	// 	// Calculate tile bounds and check if it intersects with trail bbox
	// 	tileBounds := m.calculateTileBounds(z, x, y)
	// 	if m.boundsIntersect(tileBounds, trailBBox) {
	// 		delete(m.cache, tileKey)
	// 		invalidatedCount++
	// 	}
	// }

	// if invalidatedCount > 0 {
	// 	log.Printf("Invalidated %d cached tiles for trail update", invalidatedCount)
	// }
}

// InvalidateAllCache clears the entire cache (for major data changes)
func (m *MVTService) InvalidateAllCache() {
	m.cacheMutex.Lock()
	defer m.cacheMutex.Unlock()

	cacheSize := len(m.cache)
	m.cache = make(map[string]*CacheEntry)
	log.Printf("Invalidated entire MVT cache (%d tiles)", cacheSize)
}

// boundsIntersect checks if two bounding boxes intersect
func (m *MVTService) boundsIntersect(tileBounds entities.TileBounds, trailBBox entities.BoundingBox) bool {
	// Convert trail bbox (likely in lat/lon) to Web Mercator for comparison
	// Simple intersection check: boxes intersect if they overlap in both X and Y
	return tileBounds.XMax >= trailBBox.West && tileBounds.XMin <= trailBBox.East &&
		tileBounds.YMax >= trailBBox.South && tileBounds.YMin <= trailBBox.North
}

// GenerateTrailsMVT generates MVT for trails with caching support
func (m *MVTService) GenerateTrailsMVT(z, x, y int) ([]byte, error) {
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

// GetTrailsMetadata returns trail metadata (for use with MVT geometry)
func (m *MVTService) GetTrailsMetadata(trailIDs []string) ([]map[string]interface{}, error) {
	if len(trailIDs) == 0 {
		return []map[string]interface{}{}, nil
	}

	// Build IN clause for SQL query
	placeholders := make([]string, len(trailIDs))
	args := make([]interface{}, len(trailIDs))
	for i, id := range trailIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT 
			id, name, description, level, tags, owner_id, 
			created_at, updated_at, elevation_data, distance_m,
			ST_AsGeoJSON(bbox) as bbox_geojson
		FROM trails 
		WHERE id IN (%s)`, strings.Join(placeholders, ","))

	rows, err := m.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query trail metadata: %w", err)
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var (
			id, name, description, level, ownerID, elevationDataStr, bboxGeoJSON string
			tags                                                                 sql.NullString
			createdAt, updatedAt                                                 string
			distanceM                                                            sql.NullFloat64
		)

		err := rows.Scan(&id, &name, &description, &level, &tags, &ownerID,
			&createdAt, &updatedAt, &elevationDataStr, &distanceM, &bboxGeoJSON)
		if err != nil {
			continue
		}

		result := map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"level":       level,
			"owner_id":    ownerID,
			"created_at":  createdAt,
			"updated_at":  updatedAt,
		}

		if tags.Valid {
			result["tags"] = tags.String
		}
		if distanceM.Valid {
			result["distance_m"] = distanceM.Float64
		}
		if elevationDataStr != "" {
			result["elevation_data"] = elevationDataStr
		}
		if bboxGeoJSON != "" {
			result["bbox"] = bboxGeoJSON
		}

		results = append(results, result)
	}

	return results, nil
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
