package types

import (
	"time"

	"bike-map-backend/interfaces"
)

// BaseEvent provides common event functionality
type BaseEvent struct {
	EventID     string      `json:"event_id"`
	EventType   string      `json:"event_type"`
	AggregateId string      `json:"aggregate_id"`
	Timestamp   time.Time   `json:"timestamp"`
	EventData   interface{} `json:"data"`
}

// ID returns the event ID
func (e BaseEvent) ID() string {
	return e.EventID
}

// Type returns the event type
func (e BaseEvent) Type() string {
	return e.EventType
}

// AggregateID returns the aggregate ID
func (e BaseEvent) AggregateID() string {
	return e.AggregateId
}

// OccurredAt returns when the event occurred
func (e BaseEvent) OccurredAt() time.Time {
	return e.Timestamp
}

// Data returns the event data
func (e BaseEvent) Data() interface{} {
	return e.EventData
}

// NewBaseEvent creates a new base event
func NewBaseEvent(eventID, eventType, aggregateID string, data interface{}) BaseEvent {
	return BaseEvent{
		EventID:     eventID,
		EventType:   eventType,
		AggregateId: aggregateID,
		Timestamp:   time.Now(),
		EventData:   data,
	}
}

// Compile-time check to ensure BaseEvent implements Event interface
var _ interfaces.Event = (*BaseEvent)(nil)
