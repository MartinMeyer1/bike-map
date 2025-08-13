package handlers

import (
	"context"
	"fmt"
	"log"

	"bike-map-backend/events/types"
	"bike-map-backend/interfaces"
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
func (h *CacheHandler) HandleTrailEvent(ctx context.Context, event interfaces.Event) error {
	var trailID string

	switch e := event.(type) {
	case *types.TrailCreated:
		trailID = e.Trail.ID
	case *types.TrailUpdated:
		trailID = e.Trail.ID
	case *types.TrailDeleted:
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
func (h *CacheHandler) HandleEngagementEvent(ctx context.Context, event interfaces.Event) error {
	var trailID string

	switch e := event.(type) {
	case *types.RatingCreated:
		trailID = e.Rating.TrailID
	case *types.RatingUpdated:
		trailID = e.Rating.TrailID
	case *types.RatingDeleted:
		trailID = e.TrailID
	case *types.CommentCreated:
		trailID = e.Comment.TrailID
	case *types.CommentUpdated:
		trailID = e.Comment.TrailID
	case *types.CommentDeleted:
		trailID = e.TrailID
	case *types.EngagementStatsUpdated:
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
