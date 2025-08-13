package events

import (
	"bike-map-backend/internal/domain/event_types"
	"bike-map-backend/internal/domain/events/handlers"
	"bike-map-backend/internal/domain/interfaces"
)

// EventRegistry configures and manages all event handlers
type EventRegistry struct {
	dispatcher  *Dispatcher
	syncHandler *handlers.SyncHandler
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
	r.dispatcher.Subscribe(event_types.TrailCreatedEvent, r.syncHandler.HandleTrailCreated)
	r.dispatcher.Subscribe(event_types.TrailUpdatedEvent, r.syncHandler.HandleTrailUpdated)
	r.dispatcher.Subscribe(event_types.TrailDeletedEvent, r.syncHandler.HandleTrailDeleted)
	
	// Trail events - cache handlers
	r.dispatcher.Subscribe(event_types.TrailCreatedEvent, r.cacheHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(event_types.TrailUpdatedEvent, r.cacheHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(event_types.TrailDeletedEvent, r.cacheHandler.HandleTrailEvent)
	
	// Trail events - audit handlers
	r.dispatcher.Subscribe(event_types.TrailCreatedEvent, r.auditHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(event_types.TrailUpdatedEvent, r.auditHandler.HandleTrailEvent)
	r.dispatcher.Subscribe(event_types.TrailDeletedEvent, r.auditHandler.HandleTrailEvent)
	
	// Engagement events - sync handlers
	r.dispatcher.Subscribe(event_types.RatingCreatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(event_types.RatingUpdatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(event_types.RatingDeletedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(event_types.CommentCreatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(event_types.CommentUpdatedEvent, r.syncHandler.HandleEngagementUpdate)
	r.dispatcher.Subscribe(event_types.CommentDeletedEvent, r.syncHandler.HandleEngagementUpdate)
	
	// Engagement events - cache handlers
	r.dispatcher.Subscribe(event_types.RatingCreatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.RatingUpdatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.RatingDeletedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.CommentCreatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.CommentUpdatedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.CommentDeletedEvent, r.cacheHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.EngagementStatsEvent, r.cacheHandler.HandleEngagementEvent)
	
	// Engagement events - audit handlers
	r.dispatcher.Subscribe(event_types.RatingCreatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.RatingUpdatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.RatingDeletedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.CommentCreatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.CommentUpdatedEvent, r.auditHandler.HandleEngagementEvent)
	r.dispatcher.Subscribe(event_types.CommentDeletedEvent, r.auditHandler.HandleEngagementEvent)
	
	// User events - audit handlers
	r.dispatcher.Subscribe(event_types.UserCreatedEvent, r.auditHandler.HandleUserEvent)
	r.dispatcher.Subscribe(event_types.UserUpdatedEvent, r.auditHandler.HandleUserEvent)
	r.dispatcher.Subscribe(event_types.UserVerifiedEvent, r.auditHandler.HandleUserEvent)
	r.dispatcher.Subscribe(event_types.UserRoleChangedEvent, r.auditHandler.HandleUserEvent)
}