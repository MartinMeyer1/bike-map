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

// NewTrail creates a new trail with required fields
func NewTrail(id, name, description string, level TrailLevel, ownerID string) *Trail {
	now := time.Now()
	return &Trail{
		ID:          id,
		Name:        name,
		Description: description,
		Level:       level,
		OwnerID:     ownerID,
		Tags:        make([]string, 0),
		Ridden:      true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// UpdateMetadata updates trail metadata
func (t *Trail) UpdateMetadata(name, description string, level TrailLevel, tags []string) {
	t.Name = name
	t.Description = description
	t.Level = level
	t.Tags = tags
	t.UpdatedAt = time.Now()
}

// SetElevationData sets the elevation data for the trail
func (t *Trail) SetElevationData(data *ElevationData) {
	t.ElevationData = data
	t.UpdatedAt = time.Now()
}

// SetDistance sets the trail distance
func (t *Trail) SetDistance(distanceM float64) {
	t.DistanceM = &distanceM
	t.UpdatedAt = time.Now()
}

// SetBoundingBox sets the geographical bounding box
func (t *Trail) SetBoundingBox(bbox *BoundingBox) {
	t.BoundingBox = bbox
	t.UpdatedAt = time.Now()
}


// IsOwnedBy checks if the trail is owned by the given user
func (t *Trail) IsOwnedBy(userID string) bool {
	return t.OwnerID == userID
}