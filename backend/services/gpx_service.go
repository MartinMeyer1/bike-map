package services

import (
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"

	"bike-map-backend/config"
	"bike-map-backend/entities"

	"log"

	_ "github.com/lib/pq"
	"github.com/pocketbase/pocketbase/core"
)

// GPXService handles GPX file processing and PostGIS operations
type GPXService struct {
	db     *sql.DB
	config *config.Config
}

// NewGPXService creates a new GPX service instance
func NewGPXService(cfg *config.Config) (*GPXService, error) {
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

	return &GPXService{
		db:     db,
		config: cfg,
	}, nil
}

// Close closes the database connection
func (g *GPXService) Close() error {
	return g.db.Close()
}

// GetTrailBoundingBox retrieves the bounding box of a trail from PostGIS
func (g *GPXService) GetTrailBoundingBox(trailID string) (*entities.BoundingBox, error) {
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
	err := g.db.QueryRow(query, trailID).Scan(&bbox.West, &bbox.South, &bbox.East, &bbox.North)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("trail %s not found or has no geometry", trailID)
		}
		return nil, fmt.Errorf("failed to get trail bounding box: %w", err)
	}

	return &bbox, nil
}

// ImportTrailFromPocketBase imports a trail from PocketBase to PostGIS
func (g *GPXService) ImportTrailFromPocketBase(app core.App, trailID string) error {
	// Get trail record from PocketBase
	trail, err := app.FindRecordById("trails", trailID)
	if err != nil {
		return fmt.Errorf("failed to find trail %s: %w", trailID, err)
	}

	// Get GPX file URL
	gpxFile := trail.GetString("file")
	if gpxFile == "" {
		return fmt.Errorf("trail %s has no GPX file", trailID)
	}

	// Download and parse GPX file
	gpxData, err := g.downloadGPXFromPocketBase(trail, gpxFile)
	if err != nil {
		return fmt.Errorf("failed to download GPX: %w", err)
	}

	gpx, err := g.parseGPX(gpxData)
	if err != nil {
		return fmt.Errorf("failed to parse GPX: %w", err)
	}

	// Convert to PostGIS format and insert
	return g.insertTrailToPostGIS(app, trail, gpx)
}

// downloadGPXFromPocketBase downloads GPX file from PocketBase storage
func (g *GPXService) downloadGPXFromPocketBase(trail *core.Record, filename string) ([]byte, error) {
	// Construct file URL
	fileURL := fmt.Sprintf("%s/api/files/trails/%s/%s", "http://localhost:8090", trail.Id, filename)

	resp, err := http.Get(fileURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download GPX file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download GPX file: status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// parseGPX parses GPX XML data
func (g *GPXService) parseGPX(data []byte) (*entities.GPX, error) {
	var gpx entities.GPX
	if err := xml.Unmarshal(data, &gpx); err != nil {
		return nil, fmt.Errorf("failed to parse GPX XML: %w", err)
	}

	if len(gpx.Tracks) == 0 {
		return nil, fmt.Errorf("no tracks found in GPX")
	}

	return &gpx, nil
}

// insertTrailToPostGIS inserts trail data into PostGIS
func (g *GPXService) insertTrailToPostGIS(app core.App, trail *core.Record, gpx *entities.GPX) error {
	// Use the first track (most GPX files have only one track)
	track := gpx.Tracks[0]

	// Collect all points from all segments
	var allPoints []entities.TrackPoint
	for _, segment := range track.Segments {
		allPoints = append(allPoints, segment.Points...)
	}

	if len(allPoints) == 0 {
		return fmt.Errorf("no track points found")
	}

	// Build LineString coordinates for PostGIS
	var coordinates []string
	for _, point := range allPoints {
		coordinates = append(coordinates, fmt.Sprintf("%f %f", point.Lon, point.Lat))
	}
	lineString := fmt.Sprintf("LINESTRING(%s)", strings.Join(coordinates, ","))

	// Calculate elevation data
	elevationData, err := g.calculateElevationData(allPoints)
	if err != nil {
		return fmt.Errorf("failed to calculate elevation data: %w", err)
	}

	elevationJSON, err := json.Marshal(elevationData)
	if err != nil {
		return fmt.Errorf("failed to marshal elevation data: %w", err)
	}

	// Prepare tags JSON
	tagsJSON := trail.GetString("tags")
	if tagsJSON == "" {
		tagsJSON = "[]"
	}

	// Get engagement data from PocketBase
	ratingAvg, ratingCount, commentCount := g.getTrailEngagementData(app, trail.Id)

	// Insert into PostGIS
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

	_, err = g.db.Exec(query,
		trail.Id,
		trail.GetString("name"),
		trail.GetString("description"),
		trail.GetString("level"),
		tagsJSON,
		trail.GetString("owner"),
		trail.GetString("file"), // GPX file name
		lineString,
		string(elevationJSON),
		trail.GetDateTime("created").Time(),
		trail.GetDateTime("updated").Time(),
		ratingAvg,
		ratingCount,
		commentCount,
		trail.GetBool("ridden"), // Default to false if not set
	)

	return err
}

// calculateElevationData calculates elevation gain, loss, and profile
func (g *GPXService) calculateElevationData(points []entities.TrackPoint) (*entities.ElevationData, error) {
	data := &entities.ElevationData{
		Profile: make([]entities.ElevationPoint, 0, len(points)),
	}

	var totalDistance float64

	for i, point := range points {
		if i > 0 {
			prevPoint := points[i-1]

			// Calculate distance using Haversine formula
			distance := g.haversineDistance(
				prevPoint.Lat, prevPoint.Lon,
				point.Lat, point.Lon,
			)
			totalDistance += distance

			// Calculate elevation change
			if point.Elevation != nil && prevPoint.Elevation != nil {
				elevChange := *point.Elevation - *prevPoint.Elevation
				if elevChange > 0 {
					data.Gain += elevChange
				} else {
					data.Loss += math.Abs(elevChange)
				}
			}
		}

		// Add to elevation profile
		if point.Elevation != nil {
			data.Profile = append(data.Profile, entities.ElevationPoint{
				Distance:  totalDistance,
				Elevation: *point.Elevation,
			})
		}
	}

	return data, nil
}

// haversineDistance calculates distance between two lat/lng points in meters
func (g *GPXService) haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000 // Earth's radius in meters

	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

// DeleteTrailFromPostGIS removes a trail from PostGIS
func (g *GPXService) DeleteTrailFromPostGIS(trailID string) error {
	query := `DELETE FROM trails WHERE id = $1`
	result, err := g.db.Exec(query, trailID)
	if err != nil {
		return fmt.Errorf("failed to delete trail %s from PostGIS: %w", trailID, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected for trail deletion: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("trail %s not found in PostGIS", trailID)
	}

	return nil
}

// ClearAllTrails removes all trails from PostGIS
func (g *GPXService) ClearAllTrails() error {
	query := `DELETE FROM trails`
	result, err := g.db.Exec(query)
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

// SyncAllTrails syncs all trails from PocketBase to PostGIS
func (g *GPXService) SyncAllTrails(app core.App) error {
	// Clear all existing trails from PostGIS first
	if err := g.ClearAllTrails(); err != nil {
		return fmt.Errorf("failed to clear existing trails: %w", err)
	}

	// Get all trails from PocketBase
	trails, err := app.FindAllRecords("trails")
	if err != nil {
		return fmt.Errorf("failed to get trails from PocketBase: %w", err)
	}

	log.Printf("Syncing %d trails from PocketBase to PostGIS\n", len(trails))

	for i, trail := range trails {
		log.Printf("Importing trail %d/%d: %s\n", i+1, len(trails), trail.GetString("name"))

		if err := g.ImportTrailFromPocketBase(app, trail.Id); err != nil {
			log.Printf("Failed to import trail %s (%s): %v\n", trail.Id, trail.GetString("name"), err)
			continue
		}
		log.Printf("Successfully imported trail: %s\n", trail.GetString("name"))
	}

	return nil
}

// getTrailEngagementData retrieves rating and comment engagement data for a trail from PocketBase
func (g *GPXService) getTrailEngagementData(app core.App, trailId string) (float64, int, int) {
	var ratingAvg float64 = 0.0
	var ratingCount int = 0
	var commentCount int = 0

	// Get rating average and count from rating_average collection
	ratingAverageCollection, err := app.FindCollectionByNameOrId("rating_average")
	if err == nil {
		averageRecords, err := app.FindRecordsByFilter(ratingAverageCollection, fmt.Sprintf("trail = '%s'", trailId), "", 1, 0)
		if err == nil && len(averageRecords) > 0 {
			record := averageRecords[0]
			ratingAvg = record.GetFloat("average")
			ratingCount = int(record.GetFloat("count"))
		}
	}

	// Get comment count from trail_comments collection
	commentsCollection, err := app.FindCollectionByNameOrId("trail_comments")
	if err == nil {
		commentRecords, err := app.FindRecordsByFilter(commentsCollection, fmt.Sprintf("trail = '%s'", trailId), "", 0, 0)
		if err == nil {
			commentCount = len(commentRecords)
		}
	}

	return ratingAvg, ratingCount, commentCount
}

// UpdateTrailEngagement updates only the engagement data for a trail in PostGIS
func (g *GPXService) UpdateTrailEngagement(app core.App, trailId string) error {
	// Get engagement data from PocketBase
	ratingAvg, ratingCount, commentCount := g.getTrailEngagementData(app, trailId)

	// Update PostGIS record
	query := `
		UPDATE trails 
		SET rating_average = $1, rating_count = $2, comment_count = $3, updated_at = NOW()
		WHERE id = $4`

	_, err := g.db.Exec(query, ratingAvg, ratingCount, commentCount, trailId)
	if err != nil {
		return fmt.Errorf("failed to update trail engagement in PostGIS: %w", err)
	}

	return nil
}

// GetDB returns the database connection for external use
func (g *GPXService) GetDB() *sql.DB {
	return g.db
}
