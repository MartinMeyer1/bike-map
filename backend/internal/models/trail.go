package models

import (
	"time"
)

// Trail represents a mountain bike trail
type Trail struct {
	ID            string    `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Description   string    `json:"description" db:"description"`
	Level         string    `json:"level" db:"level"` // S0, S1, S2, S3, S4, S5
	Tags          []string  `json:"tags" db:"tags"`
	OwnerID       string    `json:"owner_id" db:"owner_id"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
	ElevationData *ElevationData `json:"elevation_data,omitempty" db:"elevation_data"`
	DistanceM     *float64  `json:"distance_m,omitempty" db:"distance_m"`
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
