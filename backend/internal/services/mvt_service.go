package services

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"strings"
	"sync"
	"time"

	"bike-map-backend/internal/config"
	"bike-map-backend/internal/models"
)

// MVTService handles MVT generation from PostGIS
type MVTService struct {
	db           *sql.DB
	config       *config.Config
	cacheVersion string       // Random cache version for invalidation
	versionMutex sync.RWMutex // Thread-safe access
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

	// Generate initial random cache version
	initialVersion := generateRandomVersion()

	return &MVTService{
		db:           db,
		config:       cfg,
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

// calculateTileBounds calculates the bounds of a tile in Web Mercator projection
func (m *MVTService) calculateTileBounds(z, x, y int) models.TileBounds {
	// Web Mercator bounds: -20037508.34 to 20037508.34
	const worldSize = 20037508.34278924

	tileSize := worldSize * 2.0 / float64(int64(1)<<uint(z))

	return models.TileBounds{
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
		return 0.01 // Very simplified for country/regional view
	case z <= 10:
		return 0.005 // Simplified for regional view
	case z <= 12:
		return 0.001 // Moderate simplification for city view
	case z <= 14:
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

// GetCacheVersion returns the current cache version for ETag generation
func (m *MVTService) GetCacheVersion() string {
	return m.getCacheVersion()
}