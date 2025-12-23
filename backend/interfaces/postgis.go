package interfaces

import (
	"context"

	"bike-map-backend/entities"
)

// PostGISService interface for all PostGIS database operations
type PostGISService interface {
	InsertTrail(ctx context.Context, trail entities.TrailInsertData) error
	DeleteTrail(ctx context.Context, trailID string) error
	UpdateEngagementStats(ctx context.Context, trailID string, stats entities.EngagementStatsData) error
	ClearAllTrails(ctx context.Context) error

	GetTrailBoundingBox(ctx context.Context, trailID string) (*entities.BoundingBox, error)

	GenerateMVTForTile(ctx context.Context, z, x, y int, tolerance float64) ([]byte, error)
	
	Close() error
}