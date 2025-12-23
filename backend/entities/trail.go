package entities

import (
	"time"
)

// TrailLevel represents the difficulty level of a trail
type TrailLevel string

const (
	LevelS0 TrailLevel = "S0"
	LevelS1 TrailLevel = "S1"
	LevelS2 TrailLevel = "S2"
	LevelS3 TrailLevel = "S3"
	LevelS4 TrailLevel = "S4"
	LevelS5 TrailLevel = "S5"
)

// IsValid checks if the trail level is valid
func (l TrailLevel) IsValid() bool {
	switch l {
	case LevelS0, LevelS1, LevelS2, LevelS3, LevelS4, LevelS5:
		return true
	default:
		return false
	}
}

// Trail represents a mountain bike trail with all its properties
type Trail struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	Level         TrailLevel     `json:"level"`
	Tags          []string       `json:"tags"`
	OwnerID       string         `json:"owner_id"`
	GPXFile       string         `json:"gpx_file"`
	Ridden        bool           `json:"ridden"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	ElevationData *ElevationData `json:"elevation_data,omitempty"`
	DistanceM     *float64       `json:"distance_m,omitempty"`
	BoundingBox   *BoundingBox   `json:"bounding_box,omitempty"`
}

// ElevationData represents elevation profile information
type ElevationData struct {
	Gain    float64           `json:"gain"`
	Loss    float64           `json:"loss"`
	Profile []ElevationPoint `json:"profile"`
}

// ElevationPoint represents a point in the elevation profile
type ElevationPoint struct {
	Distance  float64 `json:"distance"`  // Distance in meters from start
	Elevation float64 `json:"elevation"` // Elevation in meters
}

// BoundingBox represents a geographical bounding box
type BoundingBox struct {
	North float64 `json:"north"` // Maximum latitude
	South float64 `json:"south"` // Minimum latitude
	East  float64 `json:"east"`  // Maximum longitude
	West  float64 `json:"west"`  // Minimum longitude
}