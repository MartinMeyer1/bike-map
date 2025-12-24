package interfaces

import (
	"context"

	"bike-map-backend/entities"
)

// MVTService - base interface for MVT operations (read-only)
type MVTService interface {
	GetTile(c entities.TileCoordinates) ([]byte, error)
	GetMinZoom() int
	GetMaxZoom() int
	Close() error
}

// MVTStorage - extends MVTService with write operations
type MVTStorage interface {
	MVTService
	StoreTile(c entities.TileCoordinates, data []byte) error
	ClearTile(c entities.TileCoordinates) error
	ClearAllTiles() error
}

// MVTGenerator - generates MVT tiles and manages trail data
type MVTGenerator interface {
	MVTService
	CreateTrail(ctx context.Context, trail entities.Trail) error
	UpdateTrail(ctx context.Context, trail entities.Trail) error
	DeleteTrail(trailID string) error
	ClearAllTrails(ctx context.Context) error

	GetTrailTiles(trailID string) ([]entities.TileCoordinates, error)

	// TODO remove and use UpdateTrail instead
	UpdateEngagementStats(ctx context.Context, trailID string, stats entities.EngagementStatsData) error
}
