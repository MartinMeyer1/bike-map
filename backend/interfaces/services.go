package interfaces

import (
	"context"

	"github.com/pocketbase/pocketbase/core"
)

// SyncService interface for PostGIS synchronization operations
type SyncService interface {
	SyncTrailToPostGIS(ctx context.Context, trailID string) error
	SyncTrailToPostGISWithGeometry(ctx context.Context, app core.App, trailID string) error
	RemoveTrailFromPostGIS(ctx context.Context, trailID string) error
	UpdateEngagementStats(ctx context.Context, trailID string) error
}