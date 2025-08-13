package handlers

import (
	"context"
	"fmt"
	"log"

	"bike-map-backend/internal/domain/event_types"
	"bike-map-backend/internal/domain/interfaces"
)

// CacheHandler handles events that require cache invalidation
type CacheHandler struct {
	cacheService interfaces.CacheService
}

// NewCacheHandler creates a new cache handler
func NewCacheHandler(cacheService interfaces.CacheService) *CacheHandler {
	return &CacheHandler{
		cacheService: cacheService,
	}
}

// HandleTrailEvent handles trail-related events for cache invalidation
func (h *CacheHandler) HandleTrailEvent(ctx context.Context, event event_types.Event) error {
	var trailID string
	
	switch e := event.(type) {
	case *event_types.TrailCreated:
		trailID = e.Trail.ID
	case *event_types.TrailUpdated:
		trailID = e.Trail.ID
	case *event_types.TrailDeleted:
		trailID = e.TrailID
	default:
		return fmt.Errorf("unsupported event type for trail cache invalidation: %T", event)
	}

	log.Printf("Invalidating cache for trail: %s", trailID)
	
	// Invalidate trail-specific cache
	if err := h.cacheService.InvalidateTrailCache(ctx, trailID); err != nil {
		return fmt.Errorf("failed to invalidate trail cache: %w", err)
	}
	
	// Invalidate MVT cache since trail data changed
	if err := h.cacheService.InvalidateMVTCache(ctx); err != nil {
		return fmt.Errorf("failed to invalidate MVT cache: %w", err)
	}

	return nil
}

// HandleEngagementEvent handles engagement-related events for cache invalidation
func (h *CacheHandler) HandleEngagementEvent(ctx context.Context, event event_types.Event) error {
	var trailID string
	
	switch e := event.(type) {
	case *event_types.RatingCreated:
		trailID = e.Rating.TrailID
	case *event_types.RatingUpdated:
		trailID = e.Rating.TrailID
	case *event_types.RatingDeleted:
		trailID = e.TrailID
	case *event_types.CommentCreated:
		trailID = e.Comment.TrailID
	case *event_types.CommentUpdated:
		trailID = e.Comment.TrailID
	case *event_types.CommentDeleted:
		trailID = e.TrailID
	case *event_types.EngagementStatsUpdated:
		trailID = e.Stats.TrailID
	default:
		return fmt.Errorf("unsupported event type for engagement cache invalidation: %T", event)
	}

	log.Printf("Invalidating engagement cache for trail: %s", trailID)
	
	// Invalidate engagement-specific cache
	if err := h.cacheService.InvalidateEngagementCache(ctx, trailID); err != nil {
		return fmt.Errorf("failed to invalidate engagement cache: %w", err)
	}
	
	// Invalidate MVT cache since engagement data changed
	if err := h.cacheService.InvalidateMVTCache(ctx); err != nil {
		return fmt.Errorf("failed to invalidate MVT cache: %w", err)
	}

	return nil
}