package interfaces

import (
	"context"

	"bike-map/entities"

	"github.com/pocketbase/pocketbase/core"
)

// Engagement interface for engagement-related operations (ratings, comments)
type Engagement interface {
	UpdateRatingAverage(app core.App, trailID string) error
	DeleteRatingAverage(app core.App, trailID string) error
	GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error)
}
