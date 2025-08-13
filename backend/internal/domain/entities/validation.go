package entities

import "fmt"

// ValidationError represents a validation error for domain entities
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error implements the error interface
func (e ValidationError) Error() string {
	return fmt.Sprintf("validation error on field '%s': %s", e.Field, e.Message)
}

// NewValidationError creates a new validation error
func NewValidationError(field, message string) ValidationError {
	return ValidationError{
		Field:   field,
		Message: message,
	}
}

// MultiValidationError represents multiple validation errors
type MultiValidationError struct {
	Errors []ValidationError `json:"errors"`
}

// Error implements the error interface
func (e MultiValidationError) Error() string {
	if len(e.Errors) == 0 {
		return "no validation errors"
	}
	if len(e.Errors) == 1 {
		return e.Errors[0].Error()
	}
	return fmt.Sprintf("multiple validation errors: %d errors found", len(e.Errors))
}

// Add adds a validation error to the collection
func (e *MultiValidationError) Add(field, message string) {
	e.Errors = append(e.Errors, NewValidationError(field, message))
}

// HasErrors returns true if there are any validation errors
func (e *MultiValidationError) HasErrors() bool {
	return len(e.Errors) > 0
}

// NewMultiValidationError creates a new multi-validation error
func NewMultiValidationError() *MultiValidationError {
	return &MultiValidationError{
		Errors: make([]ValidationError, 0),
	}
}