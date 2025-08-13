package events

import (
	"context"
	"fmt"
	"sync"

	"bike-map-backend/interfaces"
)

// Handler represents an event handler function
type Handler func(ctx context.Context, event interfaces.Event) error

// Dispatcher manages event subscription and publishing
type Dispatcher struct {
	handlers map[string][]Handler
	mutex    sync.RWMutex
}

// NewDispatcher creates a new event dispatcher
func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		handlers: make(map[string][]Handler),
		mutex:    sync.RWMutex{},
	}
}

// Subscribe registers a handler for a specific event type
func (d *Dispatcher) Subscribe(eventType string, handler Handler) {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if d.handlers[eventType] == nil {
		d.handlers[eventType] = make([]Handler, 0)
	}
	d.handlers[eventType] = append(d.handlers[eventType], handler)
}

// Publish sends an event to all registered handlers
func (d *Dispatcher) Publish(ctx context.Context, event interfaces.Event) error {
	d.mutex.RLock()
	handlers, exists := d.handlers[event.Type()]
	d.mutex.RUnlock()

	if !exists || len(handlers) == 0 {
		return nil // No handlers registered for this event type
	}

	// Execute handlers concurrently
	var wg sync.WaitGroup
	errorChan := make(chan error, len(handlers))

	for _, handler := range handlers {
		wg.Add(1)
		go func(h Handler) {
			defer wg.Done()
			if err := h(ctx, event); err != nil {
				errorChan <- fmt.Errorf("handler error for event %s: %w", event.Type(), err)
			}
		}(handler)
	}

	wg.Wait()
	close(errorChan)

	// Collect any errors
	var errors []error
	for err := range errorChan {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("event publishing errors: %v", errors)
	}

	return nil
}

// PublishSync sends an event to all registered handlers synchronously
func (d *Dispatcher) PublishSync(ctx context.Context, event interfaces.Event) error {
	d.mutex.RLock()
	handlers, exists := d.handlers[event.Type()]
	d.mutex.RUnlock()

	if !exists || len(handlers) == 0 {
		return nil // No handlers registered for this event type
	}

	// Execute handlers synchronously
	for _, handler := range handlers {
		if err := handler(ctx, event); err != nil {
			return fmt.Errorf("handler error for event %s: %w", event.Type(), err)
		}
	}

	return nil
}

// HasHandlers checks if there are any handlers for the given event type
func (d *Dispatcher) HasHandlers(eventType string) bool {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	handlers, exists := d.handlers[eventType]
	return exists && len(handlers) > 0
}
