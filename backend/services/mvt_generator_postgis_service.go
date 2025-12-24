package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math"

	"bike-map-backend/config"
	"bike-map-backend/entities"
	"bike-map-backend/interfaces"

	_ "github.com/lib/pq"
)

// trailPostgis contains all data needed to insert a trail into PostGIS (private to this service)
type trailPostgis struct {
	ID            string
	Name          string
	Description   string
	Level         string
	Tags          string
	OwnerID       string
	GPXFile       string
	LineStringWKT string
	ElevationJSON string
	CreatedAt     interface{}
	UpdatedAt     interface{}
	RatingAvg     float64
	RatingCount   int
	CommentCount  int
	Ridden        bool
}

// MVTGeneratorPostgis handles all PostGIS database operations and implements MVTGenerator
type MVTGeneratorPostgis struct {
	db      *sql.DB
	config  *config.Config
	minZoom int
	maxZoom int
}

// NewPostGISService creates a new PostGIS service with database connection
func NewPostGISService(cfg *config.Config) (*MVTGeneratorPostgis, error) {
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

	return &MVTGeneratorPostgis{
		db:      db,
		config:  cfg,
		minZoom: 6,
		maxZoom: 18,
	}, nil
}

// GetMinZoom returns the minimum zoom level for MVT tiles
func (p *MVTGeneratorPostgis) GetMinZoom() int {
	return p.minZoom
}

// GetMaxZoom returns the maximum zoom level for MVT tiles
func (p *MVTGeneratorPostgis) GetMaxZoom() int {
	return p.maxZoom
}

// Close closes the database connection
func (p *MVTGeneratorPostgis) Close() error {
	return p.db.Close()
}

// trailToPostgis converts a public Trail entity to internal trailPostgis format
func (p *MVTGeneratorPostgis) trailToPostgis(trail entities.Trail) trailPostgis {
	return trailPostgis{
		ID:            trail.ID,
		Name:          trail.Name,
		Description:   trail.Description,
		Level:         trail.Level,
		Tags:          trail.Tags,
		OwnerID:       trail.OwnerID,
		GPXFile:       trail.GPXFile,
		LineStringWKT: trail.LineStringWKT,
		ElevationJSON: trail.ElevationJSON,
		CreatedAt:     trail.CreatedAt,
		UpdatedAt:     trail.UpdatedAt,
		RatingAvg:     trail.RatingAvg,
		RatingCount:   trail.RatingCount,
		CommentCount:  trail.CommentCount,
		Ridden:        trail.Ridden,
	}
}

// CreateTrail creates a new trail in PostGIS
func (p *MVTGeneratorPostgis) CreateTrail(ctx context.Context, trail entities.Trail) error {
	return p.insertTrail(ctx, p.trailToPostgis(trail))
}

// UpdateTrail updates an existing trail in PostGIS
func (p *MVTGeneratorPostgis) UpdateTrail(ctx context.Context, trail entities.Trail) error {
	return p.insertTrail(ctx, p.trailToPostgis(trail))
}

// insertTrail inserts or updates a trail in PostGIS (internal method)
func (p *MVTGeneratorPostgis) insertTrail(ctx context.Context, trail trailPostgis) error {
	query := `
		INSERT INTO trails (id, name, description, level, tags, owner_id, gpx_file, geom, elevation_data, created_at, updated_at, rating_average, rating_count, comment_count, ridden)
		VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 4326), $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			level = EXCLUDED.level,
			tags = EXCLUDED.tags,
			owner_id = EXCLUDED.owner_id,
			gpx_file = EXCLUDED.gpx_file,
			geom = EXCLUDED.geom,
			elevation_data = EXCLUDED.elevation_data,
			updated_at = EXCLUDED.updated_at,
			rating_average = EXCLUDED.rating_average,
			rating_count = EXCLUDED.rating_count,
			comment_count = EXCLUDED.comment_count,
			ridden = EXCLUDED.ridden`

	_, err := p.db.ExecContext(ctx, query,
		trail.ID,
		trail.Name,
		trail.Description,
		trail.Level,
		trail.Tags,
		trail.OwnerID,
		trail.GPXFile,
		trail.LineStringWKT,
		trail.ElevationJSON,
		trail.CreatedAt,
		trail.UpdatedAt,
		trail.RatingAvg,
		trail.RatingCount,
		trail.CommentCount,
		trail.Ridden,
	)

	if err != nil {
		return fmt.Errorf("failed to insert trail into PostGIS: %w", err)
	}

	return nil
}

// DeleteTrail removes a trail from PostGIS
func (p *MVTGeneratorPostgis) DeleteTrail(trailID string) error {
	query := `DELETE FROM trails WHERE id = $1`
	result, err := p.db.ExecContext(context.Background(), query, trailID)
	if err != nil {
		return fmt.Errorf("failed to delete trail from PostGIS: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		log.Printf("Trail %s not found in PostGIS (already deleted?)", trailID)
	} else {
		log.Printf("Removed trail %s from PostGIS", trailID)
	}

	return nil
}

// getTrailBoundingBox retrieves the bounding box of a trail from PostGIS
func (p *MVTGeneratorPostgis) getTrailBoundingBox(trailID string) (*entities.BoundingBox, error) {
	query := `
		SELECT
			ST_XMin(bbox) as west,
			ST_YMin(bbox) as south,
			ST_XMax(bbox) as east,
			ST_YMax(bbox) as north
		FROM trails
		WHERE id = $1 AND geom IS NOT NULL
	`

	var bbox entities.BoundingBox
	err := p.db.QueryRowContext(context.Background(), query, trailID).Scan(&bbox.West, &bbox.South, &bbox.East, &bbox.North)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("trail %s not found or has no geometry", trailID)
		}
		return nil, fmt.Errorf("failed to get trail bounding box: %w", err)
	}

	return &bbox, nil
}

// GetTrailTiles returns all tile coordinates that intersect with a trail's bounding box
func (p *MVTGeneratorPostgis) GetTrailTiles(trailID string) ([]entities.TileCoordinates, error) {
	bbox, err := p.getTrailBoundingBox(trailID)
	if err != nil {
		return nil, err
	}

	var tiles []entities.TileCoordinates

	// Calculate tiles for each zoom level
	for zoom := p.minZoom; zoom <= p.maxZoom; zoom++ {
		minX, minY, maxX, maxY := p.boundingBoxToTileRange(*bbox, zoom)

		// Skip invalid ranges
		if minX > maxX || minY > maxY {
			continue
		}

		for x := minX; x <= maxX; x++ {
			for y := minY; y <= maxY; y++ {
				tiles = append(tiles, entities.TileCoordinates{
					Z: zoom,
					X: x,
					Y: y,
				})
			}
		}
	}

	return tiles, nil
}

// UpdateEngagementStats updates only the engagement statistics for a trail in PostGIS
func (p *MVTGeneratorPostgis) UpdateEngagementStats(ctx context.Context, trailID string, stats entities.EngagementStatsData) error {
	query := `
		UPDATE trails SET
			rating_average = $2,
			rating_count = $3,
			comment_count = $4,
			updated_at = NOW()
		WHERE id = $1`

	_, err := p.db.ExecContext(ctx, query,
		trailID,
		stats.RatingAvg,
		stats.RatingCount,
		stats.CommentCount,
	)

	if err != nil {
		return fmt.Errorf("failed to update engagement stats in PostGIS: %w", err)
	}

	return nil
}

// ClearAllTrails removes all trails from PostGIS
func (p *MVTGeneratorPostgis) ClearAllTrails(ctx context.Context) error {
	query := `DELETE FROM trails`
	result, err := p.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to clear all trails from PostGIS: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected for trail clearing: %w", err)
	}

	log.Printf("Cleared %d trails from PostGIS\n", rowsAffected)
	return nil
}

// GetTile generates MVT tile data for the given coordinates
func (p *MVTGeneratorPostgis) GetTile(c entities.TileCoordinates) ([]byte, error) {
	// Calculate tile bounds
	bounds := p.calculateTileBounds(c.Z, c.X, c.Y)
	tolerance := p.calculateSimplificationTolerance(c.Z)

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
					-- Bounding box coordinates
					ST_XMin(bbox) as bbox_west,
					ST_YMin(bbox) as bbox_south,
					ST_XMax(bbox) as bbox_east,
					ST_YMax(bbox) as bbox_north,
					-- Start/End points
					ST_X(ST_StartPoint(geom)) as start_lng,
					ST_Y(ST_StartPoint(geom)) as start_lat,
					ST_X(ST_EndPoint(geom)) as end_lng,
					ST_Y(ST_EndPoint(geom)) as end_lat,
					-- Trail statistics
					distance_m,
					-- Elevation data (extract key metrics)
					COALESCE((elevation_data->>'gain')::REAL, 0) as elevation_gain_meters,
					COALESCE((elevation_data->>'loss')::REAL, 0) as elevation_loss_meters,
					-- Min/Max elevation from profile data
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
					-- Bounding box coordinates
					ST_XMin(bbox) as bbox_west,
					ST_YMin(bbox) as bbox_south,
					ST_XMax(bbox) as bbox_east,
					ST_YMax(bbox) as bbox_north,
					-- Start/End points
					ST_X(ST_StartPoint(geom)) as start_lng,
					ST_Y(ST_StartPoint(geom)) as start_lat,
					ST_X(ST_EndPoint(geom)) as end_lng,
					ST_Y(ST_EndPoint(geom)) as end_lat,
					-- Trail statistics
					distance_m,
					-- Elevation data (extract key metrics)
					COALESCE((elevation_data->>'gain')::REAL, 0) as elevation_gain_meters,
					COALESCE((elevation_data->>'loss')::REAL, 0) as elevation_loss_meters,
					-- Min/Max elevation from profile data
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
	err := p.db.QueryRowContext(context.Background(), query, args...).Scan(&mvtData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate MVT: %w", err)
	}

	return mvtData, nil
}

// calculateTileBounds calculates the bounds of a tile in Web Mercator projection
func (p *MVTGeneratorPostgis) calculateTileBounds(z, x, y int) entities.TileBounds {
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
func (p *MVTGeneratorPostgis) calculateSimplificationTolerance(z int) float64 {
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
func (p *MVTGeneratorPostgis) latLngToTileCoords(lat, lng float64, zoom int) (int, int) {
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
func (p *MVTGeneratorPostgis) boundingBoxToTileRange(bbox entities.BoundingBox, zoom int) (minX, minY, maxX, maxY int) {
	// Validate bbox is not degenerate
	if bbox.North <= bbox.South || bbox.East <= bbox.West {
		// Return empty range that will be skipped in loops
		return 0, 0, -1, -1
	}

	// Convert bounding box corners to tile coordinates
	// Note: North = max lat, South = min lat, East = max lng, West = min lng
	minX, maxY = p.latLngToTileCoords(bbox.South, bbox.West, zoom) // Bottom-left corner
	maxX, minY = p.latLngToTileCoords(bbox.North, bbox.East, zoom) // Top-right corner

	// Ensure proper ordering (min <= max) - should not be needed with valid bbox, but safety check
	if minX > maxX {
		minX, maxX = maxX, minX
	}
	if minY > maxY {
		minY, maxY = maxY, minY
	}

	return minX, minY, maxX, maxY
}

// Compile-time check to ensure PostGISService implements interfaces.MVTGenerator
var _ interfaces.MVTGenerator = (*MVTGeneratorPostgis)(nil)
