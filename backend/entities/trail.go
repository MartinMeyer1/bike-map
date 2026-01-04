package entities

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

// ElevationData represents elevation profile information
type ElevationData struct {
	Gain    float64          `json:"gain"`
	Loss    float64          `json:"loss"`
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

// Trail contains all data needed for trail operations
type Trail struct {
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
