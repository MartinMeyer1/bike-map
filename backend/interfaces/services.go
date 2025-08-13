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

// CacheService interface for cache management operations
type CacheService interface {
	InvalidateTrailCache(ctx context.Context, trailID string) error
	InvalidateMVTCache(ctx context.Context) error
	InvalidateEngagementCache(ctx context.Context, trailID string) error
}

// AuditService interface for audit logging operations
type AuditService interface {
	LogEvent(ctx context.Context, eventType, aggregateID string, data interface{}) error
	LogUserAction(ctx context.Context, userID, action, resource string, metadata map[string]interface{}) error
}