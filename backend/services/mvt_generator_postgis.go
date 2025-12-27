package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"bike-map/config"
	"bike-map/entities"
	"bike-map/interfaces"

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
	_, err := p.db.ExecContext(context.Background(), query, trailID)
	if err != nil {
		return fmt.Errorf("failed to delete trail from PostGIS: %w", err)
	}

	return nil
}

// GetTrailTiles returns all tile coordinates that intersect with a trail's bounding box
func (p *MVTGeneratorPostgis) GetTrailTiles(trailID string) ([]entities.TileCoordinates, error) {
	query := `SELECT z, x, y FROM trail_tiles WHERE trail_id = $1 ORDER BY z, x, y`

	rows, err := p.db.Query(query, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tiles for trail: %w", err)
	}
	defer rows.Close()

	var tiles []entities.TileCoordinates
	for rows.Next() {
		var t entities.TileCoordinates
		if err := rows.Scan(&t.Z, &t.X, &t.Y); err != nil {
			return nil, fmt.Errorf("failed to scan tile: %w", err)
		}
		tiles = append(tiles, t)
	}

	return tiles, rows.Err()
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

// GetTile retrieves or generates MVT tile data for the given coordinates
func (p *MVTGeneratorPostgis) GetTile(c entities.TileCoordinates) ([]byte, error) {
	query := `SELECT generate_mvt_tile($1, $2, $3)`

	var data []byte
	err := p.db.QueryRow(query, c.Z, c.X, c.Y).Scan(&data)
	if err != nil {
		return nil, fmt.Errorf("failed to get tile: %w", err)
	}

	return data, nil
}

// Compile-time check to ensure PostGISService implements interfaces.MVTGenerator
var _ interfaces.MVTGenerator = (*MVTGeneratorPostgis)(nil)
