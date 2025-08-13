package events

import (
	"bike-map-backend/events/handlers"
	"bike-map-backend/events/types"
	"bike-map-backend/interfaces"
)

// EventRegistry configures and manages all event handlers
type EventRegistry struct {
	dispatcher   *Dispatcher
	syncHandler  *handlers.SyncHandler
	cacheHandler *handlers.CacheHandler
	auditHandler *handlers.AuditHandler
}

// NewEventRegistry creates a new event registry with all handlers
func NewEventRegistry(
	syncService interfaces.SyncService,
	cacheService interfaces.CacheService,
	auditService interfaces.AuditService,
) *EventRegistry {
	dispatcher := NewDispatcher()

	// Create handlers
	syncHandler := handlers.NewSyncHandler(syncService)
	cacheHandler := handlers.NewCacheHandler(cacheService)
	auditHandler := handlers.NewAuditHandler(auditService)

	registry := &EventRegistry{
		dispatcher:   dispatcher,
		syncHandler:  syncHandler,
		cacheHandler: cacheHandler,
		auditHandler: auditHandler,
	}

	// Register all event handlers
	registry.registerHandlers()

	return registry
}

// GetDispatcher returns the event dispatcher
func (r *EventRegistry) GetDispatcher() *Dispatcher {
	return r.dispatcher
}

// registerHandlers registers all event handlers with the dispatcher
func (r *EventRegistry) registerHandlers() {
	// Trail events - sync handlers
	r.dispatcher.Subscribe(types.TrailCreatedEvent, r.syncHandler.HandleTrailCreated)
	r.dispatcher.Subscribe(types.TrailUpdatedEvent, r.syncHandler.HandleTrailUpdated)
	r.dispatcher.Subscribe(types.TrailDeletedEvent, r.syncHandler.HandleTrailDeleted)

	// Trail events - cache handlers
	r.dispatcher.Subscribe(types.TrailCreatedEvent, r.cacheHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(types.TrailUpdatedEvent, r.cacheHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(types.TrailDeletedEvent, r.cacheHandler.HandleTrailEvent)

	// Trail events - audit handlers
	r.dispatcher.Subscribe(types.TrailCreatedEvent, r.auditHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(types.TrailUpdatedEvent, r.auditHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(types.TrailDeletedEvent, r.auditHandler.HandleTrailEvent)

	// Engagement events - sync handlers
	r.dispatcher.Subscribe(types.RatingCreatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(types.RatingUpdatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(types.RatingDeletedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(types.CommentCreatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(types.CommentUpdatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(types.CommentDeletedEvent, r.syncHandler.HandleEngagementUpdate)

	// Engagement events - cache handlers
	r.dispatcher.Subscribe(types.RatingCreatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.RatingUpdatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.RatingDeletedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.CommentCreatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.CommentUpdatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.CommentDeletedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.EngagementStatsEvent, r.cacheHandler.HandleEngagementEvent)

	// Engagement events - audit handlers
	r.dispatcher.Subscribe(types.RatingCreatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.RatingUpdatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.RatingDeletedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.CommentCreatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.CommentUpdatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(types.CommentDeletedEvent, r.auditHandler.HandleEngagementEvent)

	// User events - audit handlers
	r.dispatcher.Subscribe(types.UserCreatedEvent, r.auditHandler.HandleUserEvent)
	r.dispatcher.Subscribe(types.UserUpdatedEvent, r.auditHandler.HandleUserEvent)
	r.dispatcher.Subscribe(types.UserVerifiedEvent, r.auditHandler.HandleUserEvent)
	r.dispatcher.Subscribe(types.UserRoleChangedEvent, r.auditHandler.HandleUserEvent)
}
