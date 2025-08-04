package main

import (
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"

	_ "github.com/lib/pq"
	"github.com/pocketbase/pocketbase/core"
)

// GPX parsing structures
type GPX struct {
	XMLName xml.Name `xml:"gpx"`
	Tracks  []Track  `xml:"trk"`
}

type Track struct {
	Name     string        `xml:"name"`
	Segments []TrackSegment `xml:"trkseg"`
}

type TrackSegment struct {
	Points []TrackPoint `xml:"trkpt"`
}

type TrackPoint struct {
	Lat       float64  `xml:"lat,attr"`
	Lon       float64  `xml:"lon,attr"`
	Elevation *float64 `xml:"ele,omitempty"`
}

// Elevation data structure
type ElevationData struct {
	Gain    float64 `json:"gain"`
	Loss    float64 `json:"loss"`
	Profile []ElevationPoint `json:"profile"`
}

type ElevationPoint struct {
	Distance  float64 `json:"distance"`
	Elevation float64 `json:"elevation"`
}

// PostGIS configuration
type PostGISConfig struct {
	Host     string
	Port     int
	Database string
	User     string
	Password string
}

// GPX Importer service
type GPXImporter struct {
	db     *sql.DB
	config PostGISConfig
}

// NewGPXImporter creates a new GPX importer instance
func NewGPXImporter(config PostGISConfig) (*GPXImporter, error) {
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
	
	return &GPXImporter{
		db:     db,
		config: config,
	}, nil
}

// Close closes the database connection
func (g *GPXImporter) Close() error {
	return g.db.Close()
}

// ImportTrailFromPocketBase imports a trail from PocketBase to PostGIS
func (g *GPXImporter) ImportTrailFromPocketBase(app core.App, trailId string) error {
	// Get trail record from PocketBase
	trail, err := app.FindRecordById("trails", trailId)
	if err != nil {
		return fmt.Errorf("failed to find trail %s: %w", trailId, err)
	}

	// Get GPX file URL
	gpxFile := trail.GetString("file")
	if gpxFile == "" {
		return fmt.Errorf("trail %s has no GPX file", trailId)
	}

	// Download and parse GPX file
	gpxData, err := g.downloadGPXFromPocketBase(app, trail, gpxFile)
	if err != nil {
		return fmt.Errorf("failed to download GPX: %w", err)
	}

	gpx, err := g.parseGPX(gpxData)
	if err != nil {
		return fmt.Errorf("failed to parse GPX: %w", err)
	}

	// Convert to PostGIS format and insert
	return g.insertTrailToPostGIS(trail, gpx)
}

// downloadGPXFromPocketBase downloads GPX file from PocketBase storage
func (g *GPXImporter) downloadGPXFromPocketBase(app core.App, trail *core.Record, filename string) ([]byte, error) {
	// Construct file URL (similar to frontend trailCache.ts)
	baseURL := "http://localhost:8090" // TODO: Make configurable
	fileUrl := fmt.Sprintf("%s/api/files/trails/%s/%s", baseURL, trail.Id, filename)
	
	resp, err := http.Get(fileUrl)
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
func (g *GPXImporter) parseGPX(data []byte) (*GPX, error) {
	var gpx GPX
	if err := xml.Unmarshal(data, &gpx); err != nil {
		return nil, fmt.Errorf("failed to parse GPX XML: %w", err)
	}

	if len(gpx.Tracks) == 0 {
		return nil, fmt.Errorf("no tracks found in GPX")
	}

	return &gpx, nil
}

// insertTrailToPostGIS inserts trail data into PostGIS
func (g *GPXImporter) insertTrailToPostGIS(trail *core.Record, gpx *GPX) error {
	// Use the first track (most GPX files have only one track)
	track := gpx.Tracks[0]
	
	// Collect all points from all segments
	var allPoints []TrackPoint
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

	// Insert into PostGIS
	query := `
		INSERT INTO trails (id, name, description, level, tags, owner_id, geom, elevation_data)
		VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326), $8)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			level = EXCLUDED.level,
			tags = EXCLUDED.tags,
			owner_id = EXCLUDED.owner_id,
			geom = EXCLUDED.geom,
			elevation_data = EXCLUDED.elevation_data,
			updated_at = NOW()`

	_, err = g.db.Exec(query,
		trail.Id,
		trail.GetString("name"),
		trail.GetString("description"),
		trail.GetString("level"),
		tagsJSON,
		trail.GetString("owner"),
		lineString,
		string(elevationJSON),
	)

	return err
}

// calculateElevationData calculates elevation gain, loss, and profile
func (g *GPXImporter) calculateElevationData(points []TrackPoint) (*ElevationData, error) {
	data := &ElevationData{
		Profile: make([]ElevationPoint, 0, len(points)),
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
			data.Profile = append(data.Profile, ElevationPoint{
				Distance:  totalDistance,
				Elevation: *point.Elevation,
			})
		}
	}

	return data, nil
}

// haversineDistance calculates distance between two lat/lng points in meters
func (g *GPXImporter) haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000 // Earth's radius in meters
	
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
		math.Sin(dLng/2)*math.Sin(dLng/2)
	
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	
	return R * c
}

// SyncAllTrails syncs all trails from PocketBase to PostGIS
func (g *GPXImporter) SyncAllTrails(app core.App) error {
	// Get all trails from PocketBase
	trails, err := app.FindAllRecords("trails")
	if err != nil {
		return fmt.Errorf("failed to get trails from PocketBase: %w", err)
	}

	for _, trail := range trails {
		if err := g.ImportTrailFromPocketBase(app, trail.Id); err != nil {
			fmt.Printf("Failed to import trail %s (%s): %v\n", trail.Id, trail.GetString("name"), err)
			continue
		}
		fmt.Printf("Successfully imported trail: %s\n", trail.GetString("name"))
	}

	return nil
}

// GetDefaultPostGISConfig returns default PostGIS configuration
func GetDefaultPostGISConfig() PostGISConfig {
	return PostGISConfig{
		Host:     "localhost",
		Port:     5432,
		Database: "gis",
		User:     "gisuser",
		Password: "gispass",
	}
}