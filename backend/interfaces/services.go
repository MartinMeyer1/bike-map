package interfaces

import (
	"context"

	"bike-map-backend/entities"

	"github.com/pocketbase/pocketbase/core"
)

// SyncService interface for PostGIS synchronization operations
type SyncService interface {
	SyncTrailToPostGIS(ctx context.Context, app core.App, trailID string) error
	RemoveTrailFromPostGIS(ctx context.Context, trailID string) error
	UpdateEngagementStats(ctx context.Context, trailID string) error
	SyncAllTrails(ctx context.Context, app core.App) error
}

// PostGISService interface for all PostGIS database operations
type PostGISService interface {
	InsertTrail(ctx context.Context, trail entities.TrailInsertData) error
	DeleteTrail(ctx context.Context, trailID string) error
	GetTrailBoundingBox(ctx context.Context, trailID string) (*entities.BoundingBox, error)
	UpdateEngagementStats(ctx context.Context, trailID string, stats entities.EngagementStatsData) error
	ClearAllTrails(ctx context.Context) error
	GenerateMVTForTile(ctx context.Context, z, x, y int, tolerance float64) ([]byte, error)
	Close() error
}