package types

import (
	"bike-map-backend/entities"

	"github.com/google/uuid"
)

// Event types for trails
const (
	TrailCreatedEvent = "trail.created"
	TrailUpdatedEvent = "trail.updated"
	TrailDeletedEvent = "trail.deleted"
)

// TrailCreated represents a trail creation event
type TrailCreated struct {
	BaseEvent
	Trail *entities.Trail `json:"trail"`
}

// TrailUpdated represents a trail update event
type TrailUpdated struct {
	BaseEvent
	Trail    *entities.Trail `json:"trail"`
	Previous *entities.Trail `json:"previous,omitempty"`
}

// TrailDeleted represents a trail deletion event
type TrailDeleted struct {
	BaseEvent
	TrailID   string `json:"trail_id"`
	OwnerID   string `json:"owner_id"`
	TrailName string `json:"trail_name"`
}

// NewTrailCreated creates a new trail created event
func NewTrailCreated(trail *entities.Trail) *TrailCreated {
	return &TrailCreated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			TrailCreatedEvent,
			trail.ID,
			trail,
		),
		Trail: trail,
	}
}

// NewTrailUpdated creates a new trail updated event
func NewTrailUpdated(trail, previous *entities.Trail) *TrailUpdated {
	return &TrailUpdated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			TrailUpdatedEvent,
			trail.ID,
			trail,
		),
		Trail:    trail,
		Previous: previous,
	}
}

// NewTrailDeleted creates a new trail deleted event
func NewTrailDeleted(trailID, ownerID, trailName string) *TrailDeleted {
	return &TrailDeleted{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			TrailDeletedEvent,
			trailID,
			map[string]string{
				"trail_id":   trailID,
				"owner_id":   ownerID,
				"trail_name": trailName,
			},
		),
		TrailID:   trailID,
		OwnerID:   ownerID,
		TrailName: trailName,
	}
}
