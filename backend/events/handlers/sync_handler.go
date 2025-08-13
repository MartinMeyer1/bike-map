package handlers

import (
	"context"
	"fmt"
	"log"

	"bike-map-backend/events/types"
	"bike-map-backend/interfaces"
)

// SyncHandler handles events that require PostGIS synchronization
type SyncHandler struct {
	syncService interfaces.SyncService
}

// NewSyncHandler creates a new sync handler
func NewSyncHandler(syncService interfaces.SyncService) *SyncHandler {
	return &SyncHandler{
		syncService: syncService,
	}
}

// HandleTrailCreated handles trail created events
func (h *SyncHandler) HandleTrailCreated(ctx context.Context, event interfaces.Event) error {
	trailEvent, ok := event.(*types.TrailCreated)
	if !ok {
		return fmt.Errorf("invalid event type for trail created handler")
	}

	log.Printf("Syncing new trail to PostGIS: %s", trailEvent.Trail.ID)

	if err := h.syncService.SyncTrailToPostGIS(ctx, trailEvent.Trail.ID); err != nil {
		return fmt.Errorf("failed to sync trail to PostGIS: %w", err)
	}

	return nil
}

// HandleTrailUpdated handles trail updated events
func (h *SyncHandler) HandleTrailUpdated(ctx context.Context, event interfaces.Event) error {
	trailEvent, ok := event.(*types.TrailUpdated)
	if !ok {
		return fmt.Errorf("invalid event type for trail updated handler")
	}

	log.Printf("Updating trail in PostGIS: %s", trailEvent.Trail.ID)

	if err := h.syncService.SyncTrailToPostGIS(ctx, trailEvent.Trail.ID); err != nil {
		return fmt.Errorf("failed to update trail in PostGIS: %w", err)
	}

	return nil
}

// HandleTrailDeleted handles trail deleted events
func (h *SyncHandler) HandleTrailDeleted(ctx context.Context, event interfaces.Event) error {
	trailEvent, ok := event.(*types.TrailDeleted)
	if !ok {
		return fmt.Errorf("invalid event type for trail deleted handler")
	}

	log.Printf("Removing trail from PostGIS: %s", trailEvent.TrailID)

	if err := h.syncService.RemoveTrailFromPostGIS(ctx, trailEvent.TrailID); err != nil {
		return fmt.Errorf("failed to remove trail from PostGIS: %w", err)
	}

	return nil
}

// HandleEngagementUpdate handles engagement-related events
func (h *SyncHandler) HandleEngagementUpdate(ctx context.Context, event interfaces.Event) error {
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
	default:
		return fmt.Errorf("unsupported event type for engagement update: %T", event)
	}

	log.Printf("Updating engagement stats for trail: %s", trailID)

	if err := h.syncService.UpdateEngagementStats(ctx, trailID); err != nil {
		return fmt.Errorf("failed to update engagement stats: %w", err)
	}

	return nil
}
