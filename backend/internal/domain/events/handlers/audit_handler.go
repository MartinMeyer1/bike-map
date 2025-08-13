package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"bike-map-backend/internal/domain/entities"
	"bike-map-backend/internal/domain/event_types"
	"bike-map-backend/internal/domain/interfaces"
)

// AuditHandler handles events for audit logging and monitoring
type AuditHandler struct {
	auditService interfaces.AuditService
}

// NewAuditHandler creates a new audit handler
func NewAuditHandler(auditService interfaces.AuditService) *AuditHandler {
	return &AuditHandler{
		auditService: auditService,
	}
}

// HandleTrailEvent handles trail-related events for audit logging
func (h *AuditHandler) HandleTrailEvent(ctx context.Context, event event_types.Event) error {
	log.Printf("Auditing trail event: %s for aggregate: %s", event.Type(), event.AggregateID())
	
	// Log the general event
	if err := h.auditService.LogEvent(ctx, event.Type(), event.AggregateID(), event.Data()); err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}
	
	// Log specific user actions
	switch e := event.(type) {
	case *event_types.TrailCreated:
		metadata := map[string]interface{}{
			"trail_id":   e.Trail.ID,
			"trail_name": e.Trail.Name,
			"level":      e.Trail.Level,
		}
		if err := h.auditService.LogUserAction(ctx, e.Trail.OwnerID, "create", "trail", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
		
	case *event_types.TrailUpdated:
		metadata := map[string]interface{}{
			"trail_id":   e.Trail.ID,
			"trail_name": e.Trail.Name,
		}
		if e.Previous != nil {
			metadata["changes"] = calculateTrailChanges(e.Previous, e.Trail)
		}
		if err := h.auditService.LogUserAction(ctx, e.Trail.OwnerID, "update", "trail", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
		
	case *event_types.TrailDeleted:
		metadata := map[string]interface{}{
			"trail_id":   e.TrailID,
			"trail_name": e.TrailName,
		}
		if err := h.auditService.LogUserAction(ctx, e.OwnerID, "delete", "trail", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
	}
	
	return nil
}

// HandleEngagementEvent handles engagement-related events for audit logging
func (h *AuditHandler) HandleEngagementEvent(ctx context.Context, event event_types.Event) error {
	log.Printf("Auditing engagement event: %s for aggregate: %s", event.Type(), event.AggregateID())
	
	// Log the general event
	if err := h.auditService.LogEvent(ctx, event.Type(), event.AggregateID(), event.Data()); err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}
	
	// Log specific user actions
	switch e := event.(type) {
	case *event_types.RatingCreated:
		metadata := map[string]interface{}{
			"trail_id": e.Rating.TrailID,
			"rating":   e.Rating.Rating,
		}
		if err := h.auditService.LogUserAction(ctx, e.Rating.UserID, "create", "rating", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
		
	case *event_types.RatingUpdated:
		metadata := map[string]interface{}{
			"trail_id": e.Rating.TrailID,
			"rating":   e.Rating.Rating,
		}
		if e.Previous != nil {
			metadata["previous_rating"] = e.Previous.Rating
		}
		if err := h.auditService.LogUserAction(ctx, e.Rating.UserID, "update", "rating", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
		
	case *event_types.CommentCreated:
		metadata := map[string]interface{}{
			"trail_id":       e.Comment.TrailID,
			"content_length": len(e.Comment.Content),
		}
		if err := h.auditService.LogUserAction(ctx, e.Comment.UserID, "create", "comment", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
		
	case *event_types.CommentUpdated:
		metadata := map[string]interface{}{
			"trail_id":       e.Comment.TrailID,
			"content_length": len(e.Comment.Content),
		}
		if err := h.auditService.LogUserAction(ctx, e.Comment.UserID, "update", "comment", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
	}
	
	return nil
}

// HandleUserEvent handles user-related events for audit logging
func (h *AuditHandler) HandleUserEvent(ctx context.Context, event event_types.Event) error {
	log.Printf("Auditing user event: %s for aggregate: %s", event.Type(), event.AggregateID())
	
	// Log the general event
	if err := h.auditService.LogEvent(ctx, event.Type(), event.AggregateID(), event.Data()); err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}
	
	// Log specific user actions
	switch e := event.(type) {
	case *event_types.UserCreated:
		metadata := map[string]interface{}{
			"email": e.User.Email,
			"name":  e.User.Name,
			"role":  e.User.Role,
		}
		if err := h.auditService.LogUserAction(ctx, e.User.ID, "create", "user", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
		
	case *event_types.UserRoleChanged:
		metadata := map[string]interface{}{
			"new_role":      e.NewRole,
			"previous_role": e.PreviousRole,
		}
		if err := h.auditService.LogUserAction(ctx, e.UserID, "role_change", "user", metadata); err != nil {
			return fmt.Errorf("failed to log user action: %w", err)
		}
	}
	
	return nil
}

// calculateTrailChanges compares two trail entities and returns the differences
func calculateTrailChanges(previous, current *entities.Trail) map[string]interface{} {
	changes := make(map[string]interface{})
	
	if previous.Name != current.Name {
		changes["name"] = map[string]string{"from": previous.Name, "to": current.Name}
	}
	if previous.Description != current.Description {
		changes["description"] = map[string]string{"from": previous.Description, "to": current.Description}
	}
	if previous.Level != current.Level {
		changes["level"] = map[string]string{"from": string(previous.Level), "to": string(current.Level)}
	}
	
	// Compare tags
	prevTags, _ := json.Marshal(previous.Tags)
	currTags, _ := json.Marshal(current.Tags)
	if string(prevTags) != string(currTags) {
		changes["tags"] = map[string]interface{}{"from": previous.Tags, "to": current.Tags}
	}
	
	return changes
}