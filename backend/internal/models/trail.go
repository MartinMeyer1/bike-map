package models

import (
	"encoding/xml"
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

// GPX parsing structures
type GPX struct {
	XMLName xml.Name `xml:"gpx"`
	Tracks  []Track  `xml:"trk"`
}

type Track struct {
	Name     string         `xml:"name"`
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

// TileBounds represents tile bounds in Web Mercator projection
type TileBounds struct {
	XMin, YMin, XMax, YMax float64
}

// UserRole represents available user roles
type UserRole string

const (
	RoleViewer UserRole = "Viewer"
	RoleEditor UserRole = "Editor"
	RoleAdmin  UserRole = "Admin"
)

// IsValidRole checks if the role is valid
func (r UserRole) IsValid() bool {
	switch r {
	case RoleViewer, RoleEditor, RoleAdmin:
		return true
	default:
		return false
	}
}

// CanCreateTrails checks if the role can create trails
func (r UserRole) CanCreateTrails() bool {
	return r == RoleEditor || r == RoleAdmin
}

// CanManageUsers checks if the role can manage other users
func (r UserRole) CanManageUsers() bool {
	return r == RoleAdmin
}