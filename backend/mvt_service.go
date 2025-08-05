package main

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// MVTService handles MVT generation from PostGIS
type MVTService struct {
	db           *sql.DB
	config       PostGISConfig
	cacheVersion string     // Random cache version for invalidation
	versionMutex sync.RWMutex // Thread-safe access
}

// NewMVTService creates a new MVT service instance
func NewMVTService(config PostGISConfig) (*MVTService, error) {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		config.Host, config.Port, config.User, config.Password, config.Database)
	
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostGIS: %w", err)
	}
	
	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping PostGIS: %w", err)
	}
	
	// Generate initial random cache version
	initialVersion := generateRandomVersion()
	
	return &MVTService{
		db:           db,
		config:       config,
		cacheVersion: initialVersion,
	}, nil
}

// Close closes the database connection
func (m *MVTService) Close() error {
	return m.db.Close()
}

// generateRandomVersion creates a random version string
func generateRandomVersion() string {
	// Generate random 6-digit number
	max := big.NewInt(999999)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		// Fallback to timestamp-based if crypto fails
		return fmt.Sprintf("%d", time.Now().UnixNano()%999999)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// InvalidateCache generates a new random cache version
func (m *MVTService) InvalidateCache() {
	m.versionMutex.Lock()
	defer m.versionMutex.Unlock()
	
	oldVersion := m.cacheVersion
	m.cacheVersion = generateRandomVersion()
	log.Printf("MVT cache invalidated: %s → %s", oldVersion, m.cacheVersion)
}

// getCacheVersion returns the current cache version (thread-safe)
func (m *MVTService) getCacheVersion() string {
	m.versionMutex.RLock()
	defer m.versionMutex.RUnlock()
	return m.cacheVersion
}

// GenerateTrailsMVT generates MVT for trails based on zoom level and bounding box
func (m *MVTService) GenerateTrailsMVT(z, x, y int) ([]byte, error) {
	// Calculate tile bounds
	bounds := calculateTileBounds(z, x, y)
	
	// Determine simplification tolerance based on zoom level
	tolerance := calculateSimplificationTolerance(z)
	
	// Generate MVT using PostGIS ST_AsMVT function
	var query string
	var args []interface{}
	
	if tolerance > 0 {
		query = `
			WITH mvt_geom AS (
				SELECT 
					id,
					name,
					level,
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
					level,
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

	return mvtData, nil
}

// TileBounds represents tile bounds in Web Mercator projection
type TileBounds struct {
	XMin, YMin, XMax, YMax float64
}

// calculateTileBounds calculates the bounds of a tile in Web Mercator projection
func calculateTileBounds(z, x, y int) TileBounds {
	// Web Mercator bounds: -20037508.34 to 20037508.34
	const worldSize = 20037508.34278924

	tileSize := worldSize * 2.0 / float64(int64(1)<<uint(z))
	
	return TileBounds{
		XMin: -worldSize + float64(x)*tileSize,
		YMin: worldSize - float64(y+1)*tileSize,
		XMax: -worldSize + float64(x+1)*tileSize,
		YMax: worldSize - float64(y)*tileSize,
	}
}

// calculateSimplificationTolerance returns geometry simplification tolerance based on zoom level
func calculateSimplificationTolerance(z int) float64 {
	// More aggressive simplification at lower zoom levels
	switch {
	case z <= 8:
		return 0.01   // Very simplified for country/regional view
	case z <= 10:
		return 0.005  // Simplified for regional view
	case z <= 12:
		return 0.001  // Moderate simplification for city view
	case z <= 14:
		return 0.0005 // Light simplification for neighborhood view
	default:
		return 0      // No simplification for detailed view
	}
}

// SetupMVTRoutes adds MVT endpoints to the router
func SetupMVTRoutes(e *core.ServeEvent, mvtService *MVTService) {

	// Add OPTIONS handler for CORS preflight
	e.Router.OPTIONS("/api/mvt/trails", func(re *core.RequestEvent) error {
		re.Response.Header().Set("Access-Control-Allow-Origin", "*")
		re.Response.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		re.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		re.Response.WriteHeader(http.StatusOK)
		return nil
	})

	// Add standard MVT endpoints using wildcard pattern since PocketBase doesn't support multi-level parameters
	// Support standard path format /api/tiles/{z}/{x}/{y}.mvt
	e.Router.GET("/api/tiles/{path...}", func(re *core.RequestEvent) error {
		return handleMVTRequestWithPath(re, mvtService)
	})

}

// handleMVTRequestWithPath handles MVT requests using wildcard path parsing
func handleMVTRequestWithPath(re *core.RequestEvent, mvtService *MVTService) error {
	// Set CORS headers first
	re.Response.Header().Set("Access-Control-Allow-Origin", "*")
	re.Response.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	re.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	
	// Extract path from wildcard parameter
	pathParam := re.Request.PathValue("path")
	
	// Remove file extensions (.mvt, .pbf)
	pathParam = strings.TrimSuffix(pathParam, ".mvt")
	pathParam = strings.TrimSuffix(pathParam, ".pbf")
	
	// Split path into z/x/y components
	parts := strings.Split(pathParam, "/")
	if len(parts) != 3 {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid path format. Expected: /api/tiles/{z}/{x}/{y}.mvt"))
		return nil
	}
	
	// Parse coordinates
	z, err := strconv.Atoi(parts[0])
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid zoom level"))
		return nil
	}
	
	x, err := strconv.Atoi(parts[1])
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid x coordinate"))
		return nil
	}
	
	y, err := strconv.Atoi(parts[2])
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid y coordinate"))
		return nil
	}

	// Validate tile coordinates
	if z < 0 || z > 18 || x < 0 || y < 0 || x >= (1<<uint(z)) || y >= (1<<uint(z)) {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid tile coordinates"))
		return nil
	}

	// Generate MVT
	log.Printf("Generating standard MVT for tile %d/%d/%d", z, x, y)
	mvtData, err := mvtService.GenerateTrailsMVT(z, x, y)
	if err != nil {
		log.Printf("Failed to generate MVT for tile %d/%d/%d: %v", z, x, y, err)
		re.Response.WriteHeader(http.StatusInternalServerError)
		re.Response.Write([]byte(fmt.Sprintf("Failed to generate tile: %v", err)))
		return nil
	}
	log.Printf("Generated standard MVT tile size: %d bytes", len(mvtData))

	// Set standard MVT headers (CORS already set above)
	re.Response.Header().Set("Content-Type", "application/vnd.mapbox-vector-tile")
	
	// Set proper caching headers for tiles
	re.Response.Header().Set("Cache-Control", "public, max-age=86400") // Cache for 24 hours
	
	// Generate ETag with cache version
	currentVersion := mvtService.getCacheVersion()
	etag := fmt.Sprintf(`"mvt-v%s-%d-%d-%d"`, currentVersion, z, x, y)
	re.Response.Header().Set("ETag", etag)
	
	// Check if client has cached version
	if re.Request.Header.Get("If-None-Match") == etag {
		re.Response.WriteHeader(http.StatusNotModified)
		return nil
	}
	
	// Write MVT data
	re.Response.WriteHeader(http.StatusOK)
	re.Response.Write(mvtData)
	
	return nil
}


// GetTrailsMetadata returns trail metadata (for use with MVT geometry)
func (m *MVTService) GetTrailsMetadata(trailIds []string) ([]map[string]interface{}, error) {
	if len(trailIds) == 0 {
		return []map[string]interface{}{}, nil
	}

	// Build IN clause for SQL query
	placeholders := make([]string, len(trailIds))
	args := make([]interface{}, len(trailIds))
	for i, id := range trailIds {
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
			tags                                                                  sql.NullString
			createdAt, updatedAt                                                  string
			distanceM                                                             sql.NullFloat64
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