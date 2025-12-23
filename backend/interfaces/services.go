package interfaces

import (
	"context"

	"github.com/pocketbase/pocketbase/core"
)

// SyncService interface for PostGIS synchronization operations
type SyncService interface {
	SyncAllTrailsFromPBToPostgis(ctx context.Context, app core.App) error

	HandleTrailCreated(ctx context.Context, app core.App, trailID string) error
	HandleTrailUpdated(ctx context.Context, app core.App, trailID string) error
	HandleTrailDeleted(ctx context.Context, trailID string) error

	HandleRatingCreated(ctx context.Context, app core.App, trailID string) error
	HandleRatingUpdated(ctx context.Context, app core.App, trailID string) error
	HandleRatingDeleted(ctx context.Context, app core.App, trailID string) error

	HandleCommentCreated(ctx context.Context, trailID string) error
	HandleCommentDeleted(ctx context.Context, trailID string) error
}