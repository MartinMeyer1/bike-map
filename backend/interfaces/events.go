package interfaces

import (
	"time"
)

// Event represents a domain event that occurred in the system
type Event interface {
	ID() string
	Type() string
	AggregateID() string
	OccurredAt() time.Time
	Data() interface{}
}