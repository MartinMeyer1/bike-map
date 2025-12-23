package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"bike-map-backend/config"
	"bike-map-backend/entities"
	"bike-map-backend/interfaces"

	_ "github.com/lib/pq"
)

// PostGISService handles all PostGIS database operations
type PostGISService struct {
	db     *sql.DB
	config *config.Config
}

// NewPostGISService creates a new PostGIS service with database connection
func NewPostGISService(cfg *config.Config) (*PostGISService, error) {
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

	return &PostGISService{
		db:     db,
		config: cfg,
	}, nil
}

// Close closes the database connection
func (p *PostGISService) Close() error {
	return p.db.Close()
}

// InsertTrail inserts or updates a trail in PostGIS
func (p *PostGISService) InsertTrail(ctx context.Context, trail entities.TrailInsertData) error {
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
func (p *PostGISService) DeleteTrail(ctx context.Context, trailID string) error {
	query := `DELETE FROM trails WHERE id = $1`
	result, err := p.db.ExecContext(ctx, query, trailID)
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

// GetTrailBoundingBox retrieves the bounding box of a trail from PostGIS
func (p *PostGISService) GetTrailBoundingBox(ctx context.Context, trailID string) (*entities.BoundingBox, error) {
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
	err := p.db.QueryRowContext(ctx, query, trailID).Scan(&bbox.West, &bbox.South, &bbox.East, &bbox.North)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("trail %s not found or has no geometry", trailID)
		}
		return nil, fmt.Errorf("failed to get trail bounding box: %w", err)
	}

	return &bbox, nil
}

// UpdateEngagementStats updates only the engagement statistics for a trail in PostGIS
func (p *PostGISService) UpdateEngagementStats(ctx context.Context, trailID string, stats entities.EngagementStatsData) error {
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
func (p *PostGISService) ClearAllTrails(ctx context.Context) error {
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

// GenerateMVTForTile generates MVT tile data for the given coordinates
func (p *PostGISService) GenerateMVTForTile(ctx context.Context, z, x, y int, tolerance float64) ([]byte, error) {
	// Calculate tile bounds
	bounds := p.calculateTileBounds(z, x, y)

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
	err := p.db.QueryRowContext(ctx, query, args...).Scan(&mvtData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate MVT: %w", err)
	}

	return mvtData, nil
}

// calculateTileBounds calculates the bounds of a tile in Web Mercator projection
func (p *PostGISService) calculateTileBounds(z, x, y int) entities.TileBounds {
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

// Compile-time check to ensure PostGISService implements interfaces.PostGISService
var _ interfaces.PostGISService = (*PostGISService)(nil)
