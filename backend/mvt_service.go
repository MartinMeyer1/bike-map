package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// MVTService handles MVT generation from PostGIS
type MVTService struct {
	db     *sql.DB
	config PostGISConfig
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
	
	return &MVTService{
		db:     db,
		config: config,
	}, nil
}

// Close closes the database connection
func (m *MVTService) Close() error {
	return m.db.Close()
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

	// Add trail MVT endpoint
	e.Router.GET("/api/mvt/trails", func(re *core.RequestEvent) error {
		// Set CORS headers
		re.Response.Header().Set("Access-Control-Allow-Origin", "*")
		re.Response.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		re.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		// Parse query parameters for tile coordinates
		z, err := strconv.Atoi(re.Request.URL.Query().Get("z"))
		if err != nil {
			re.Response.WriteHeader(http.StatusBadRequest)
			re.Response.Write([]byte("Missing or invalid zoom level"))
			return nil
		}
		
		x, err := strconv.Atoi(re.Request.URL.Query().Get("x"))
		if err != nil {
			re.Response.WriteHeader(http.StatusBadRequest)
			re.Response.Write([]byte("Missing or invalid x coordinate"))
			return nil
		}
		
		y, err := strconv.Atoi(re.Request.URL.Query().Get("y"))
		if err != nil {
			re.Response.WriteHeader(http.StatusBadRequest)
			re.Response.Write([]byte("Missing or invalid y coordinate"))
			return nil
		}

		// Validate tile coordinates
		if z < 0 || z > 18 || x < 0 || y < 0 || x >= (1<<uint(z)) || y >= (1<<uint(z)) {
			re.Response.WriteHeader(http.StatusBadRequest)
			re.Response.Write([]byte("Invalid tile coordinates"))
			return nil
		}

		// Generate MVT
		log.Printf("Generating MVT for tile %d/%d/%d", z, x, y)
		mvtData, err := mvtService.GenerateTrailsMVT(z, x, y)
		if err != nil {
			log.Printf("Failed to generate MVT for tile %d/%d/%d: %v", z, x, y, err)
			re.Response.WriteHeader(http.StatusInternalServerError)
			re.Response.Write([]byte(fmt.Sprintf("Failed to generate tile: %v", err)))
			return nil
		}
		log.Printf("Generated MVT tile size: %d bytes", len(mvtData))

		// Set appropriate headers for MVT (CORS already set above)
		re.Response.Header().Set("Content-Type", "application/vnd.mapbox-vector-tile")
		re.Response.Header().Set("Cache-Control", "public, max-age=3600") // Cache for 1 hour
		
		// Write MVT data
		re.Response.WriteHeader(http.StatusOK)
		re.Response.Write(mvtData)
		
		return nil
	})

	// Add sync endpoint to manually trigger sync from PocketBase to PostGIS
	e.Router.POST("/api/mvt/sync", func(re *core.RequestEvent) error {
		// Check if user is authenticated and has admin role
		reqInfo, err := re.RequestInfo()
		if err != nil || reqInfo.Auth == nil {
			re.Response.WriteHeader(http.StatusUnauthorized)
			re.Response.Write([]byte("Authentication required"))
			return nil
		}

		userRole := reqInfo.Auth.GetString("role")
		if userRole != "Admin" {
			re.Response.WriteHeader(http.StatusForbidden)
			re.Response.Write([]byte("Admin role required"))
			return nil
		}

		// Initialize GPX importer
		gpxImporter, err := NewGPXImporter(GetDefaultPostGISConfig())
		if err != nil {
			log.Printf("Failed to initialize GPX importer: %v", err)
			re.Response.WriteHeader(http.StatusInternalServerError)
			re.Response.Write([]byte("Failed to initialize importer"))
			return nil
		}
		defer gpxImporter.Close()

		// Get app instance from context
		app := re.App

		if err := gpxImporter.SyncAllTrails(app); err != nil {
			log.Printf("Failed to sync trails: %v", err)
			re.Response.WriteHeader(http.StatusInternalServerError)
			re.Response.Write([]byte("Failed to sync trails"))
			return nil
		}

		re.Response.WriteHeader(http.StatusOK)
		re.Response.Write([]byte("Trails synced successfully"))
		return nil
	})
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