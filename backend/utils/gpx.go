package utils

import (
	"encoding/xml"
	"fmt"
	"math"
	"strings"

	"bike-map/entities"
)

// parsedGPXData contains the result of parsing a GPX file
type parsedGPXData struct {
	LineStringWKT string
	ElevationData *entities.ElevationData
}

// parseGPXFile parses GPX data and returns structured data ready for PostGIS insertion
func ParseGPXFile(data []byte) (*parsedGPXData, error) {
	gpx, err := parseGPX(data)
	if err != nil {
		return nil, err
	}

	// Use the first track (most GPX files have only one track)
	track := gpx.Tracks[0]

	// Collect all points from all segments
	var allPoints []entities.TrackPoint
	for _, segment := range track.Segments {
		allPoints = append(allPoints, segment.Points...)
	}

	if len(allPoints) == 0 {
		return nil, fmt.Errorf("no track points found")
	}

	// Build LineString coordinates for PostGIS
	var coordinates []string
	for _, point := range allPoints {
		coordinates = append(coordinates, fmt.Sprintf("%f %f", point.Lon, point.Lat))
	}
	lineString := fmt.Sprintf("LINESTRING(%s)", strings.Join(coordinates, ","))

	// Calculate elevation data
	elevationData := calculateElevationData(allPoints)

	return &parsedGPXData{
		LineStringWKT: lineString,
		ElevationData: elevationData,
	}, nil
}

// parseGPX parses GPX XML data
func parseGPX(data []byte) (*entities.GPX, error) {
	var gpx entities.GPX
	if err := xml.Unmarshal(data, &gpx); err != nil {
		return nil, fmt.Errorf("failed to parse GPX XML: %w", err)
	}

	if len(gpx.Tracks) == 0 {
		return nil, fmt.Errorf("no tracks found in GPX")
	}

	return &gpx, nil
}

// calculateElevationData calculates elevation gain, loss, and profile
func calculateElevationData(points []entities.TrackPoint) *entities.ElevationData {
	data := &entities.ElevationData{
		Profile: make([]entities.ElevationPoint, 0, len(points)),
	}

	var totalDistance float64

	for i, point := range points {
		if i > 0 {
			prevPoint := points[i-1]

			// Calculate distance using Haversine formula
			distance := haversineDistance(
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

	return data
}

// haversineDistance calculates distance between two lat/lng points in meters
func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000 // Earth's radius in meters

	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
