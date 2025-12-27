package interfaces

import (
	"context"

	"bike-map/entities"

	"github.com/pocketbase/pocketbase/core"
)

// OrchestrationService interface for PostGIS synchronization operations
type SyncTrailsService interface {
	SyncAllTrails(ctx context.Context, app core.App) error

	HandleTrailCreated(ctx context.Context, app core.App, trailID string) error
	HandleTrailUpdated(ctx context.Context, app core.App, trailID string) error
	HandleTrailDeleted(ctx context.Context, trailID string) error

	HandleRatingCreated(ctx context.Context, app core.App, trailID string) error
	HandleRatingUpdated(ctx context.Context, app core.App, trailID string) error
	HandleRatingDeleted(ctx context.Context, app core.App, trailID string) error

	HandleCommentCreated(ctx context.Context, trailID string) error
	HandleCommentDeleted(ctx context.Context, trailID string) error
}

// EngagementService interface for engagement-related operations (ratings, comments)
type EngagementService interface {
	UpdateRatingAverage(app core.App, trailID string) error
	DeleteRatingAverage(app core.App, trailID string) error
	GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error)
}
