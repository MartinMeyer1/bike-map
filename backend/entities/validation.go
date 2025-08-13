package entities

import (
	"fmt"
	"regexp"
	"strings"
)

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

var (
	// emailRegex is a basic email validation regex
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
)

// TrailValidator validates trail entities and related data
type TrailValidator struct{}

// NewTrailValidator creates a new trail validator
func NewTrailValidator() *TrailValidator {
	return &TrailValidator{}
}

// ValidateTrailCreation validates data for trail creation
func (v *TrailValidator) ValidateTrailCreation(name, description string, level TrailLevel, tags []string) *MultiValidationError {
	errors := NewMultiValidationError()

	// Validate name
	if strings.TrimSpace(name) == "" {
		errors.Add("name", "Trail name cannot be empty")
	} else if len(name) > 100 {
		errors.Add("name", "Trail name cannot exceed 100 characters")
	}

	// Validate description
	if len(description) > 1000 {
		errors.Add("description", "Description cannot exceed 1000 characters")
	}

	// Validate level
	if !level.IsValid() {
		errors.Add("level", "Invalid trail difficulty level")
	}

	// Validate tags
	if len(tags) > 10 {
		errors.Add("tags", "Cannot have more than 10 tags")
	}
	for i, tag := range tags {
		trimmedTag := strings.TrimSpace(tag)
		if trimmedTag == "" {
			errors.Add("tags", "Tag cannot be empty")
		} else if len(trimmedTag) > 50 {
			errors.Add("tags", "Tag cannot exceed 50 characters")
		}
		tags[i] = trimmedTag
	}

	return errors
}

// ValidateTrailEntity validates an existing trail entity for integrity
func (v *TrailValidator) ValidateTrailEntity(trail *Trail) *MultiValidationError {
	errors := NewMultiValidationError()

	if trail.ID == "" {
		errors.Add("id", "ID cannot be empty")
	}
	if trail.Name == "" {
		errors.Add("name", "Name cannot be empty")
	}
	if trail.OwnerID == "" {
		errors.Add("owner_id", "Owner ID cannot be empty")
	}
	if !trail.Level.IsValid() {
		errors.Add("level", "Invalid trail level")
	}

	return errors
}

// ValidateElevationData validates elevation data
func (v *TrailValidator) ValidateElevationData(data *ElevationData) *MultiValidationError {
	errors := NewMultiValidationError()

	if data == nil {
		return errors
	}

	// Validate gain/loss values
	if data.Gain < 0 {
		errors.Add("elevation_gain", "Elevation gain cannot be negative")
	}
	if data.Loss < 0 {
		errors.Add("elevation_loss", "Elevation loss cannot be negative")
	}

	// Validate profile points
	if len(data.Profile) > 10000 {
		errors.Add("elevation_profile", "Elevation profile cannot exceed 10000 points")
	}

	for i, point := range data.Profile {
		if point.Distance < 0 {
			errors.Add("elevation_profile", "Distance cannot be negative")
		}
		if i > 0 && point.Distance <= data.Profile[i-1].Distance {
			errors.Add("elevation_profile", "Profile points must be in ascending distance order")
		}
	}

	return errors
}

// EngagementValidator validates engagement-related entities
type EngagementValidator struct{}

// NewEngagementValidator creates a new engagement validator
func NewEngagementValidator() *EngagementValidator {
	return &EngagementValidator{}
}

// ValidateRatingCreation validates data for rating creation
func (v *EngagementValidator) ValidateRatingCreation(rating int) *MultiValidationError {
	errors := NewMultiValidationError()

	if rating < 1 || rating > 5 {
		errors.Add("rating", "Rating must be between 1 and 5 stars")
	}

	return errors
}

// ValidateRatingEntity validates an existing rating entity for integrity
func (v *EngagementValidator) ValidateRatingEntity(rating *Rating) *MultiValidationError {
	errors := NewMultiValidationError()

	if rating.ID == "" {
		errors.Add("id", "ID cannot be empty")
	}
	if rating.TrailID == "" {
		errors.Add("trail_id", "Trail ID cannot be empty")
	}
	if rating.UserID == "" {
		errors.Add("user_id", "User ID cannot be empty")
	}
	if rating.Rating < 1 || rating.Rating > 5 {
		errors.Add("rating", "Rating must be between 1 and 5")
	}

	return errors
}

// ValidateCommentEntity validates an existing comment entity for integrity
func (v *EngagementValidator) ValidateCommentEntity(comment *Comment) *MultiValidationError {
	errors := NewMultiValidationError()

	if comment.ID == "" {
		errors.Add("id", "ID cannot be empty")
	}
	if comment.TrailID == "" {
		errors.Add("trail_id", "Trail ID cannot be empty")
	}
	if comment.UserID == "" {
		errors.Add("user_id", "User ID cannot be empty")
	}
	if comment.Content == "" {
		errors.Add("content", "Content cannot be empty")
	}
	if len(comment.Content) > 1000 {
		errors.Add("content", "Content cannot exceed 1000 characters")
	}

	return errors
}

// ValidateRatingAverageEntity validates an existing rating average entity for integrity
func (v *EngagementValidator) ValidateRatingAverageEntity(ra *RatingAverage) *MultiValidationError {
	errors := NewMultiValidationError()

	if ra.ID == "" {
		errors.Add("id", "ID cannot be empty")
	}
	if ra.TrailID == "" {
		errors.Add("trail_id", "Trail ID cannot be empty")
	}
	if ra.Average < 0 || ra.Average > 5 {
		errors.Add("average", "Rating average must be between 0 and 5")
	}
	if ra.Count < 0 {
		errors.Add("count", "Rating count cannot be negative")
	}

	return errors
}

// ValidateCommentCreation validates data for comment creation
func (v *EngagementValidator) ValidateCommentCreation(content string) *MultiValidationError {
	errors := NewMultiValidationError()

	trimmedContent := strings.TrimSpace(content)
	if trimmedContent == "" {
		errors.Add("content", "Comment content cannot be empty")
	} else if len(trimmedContent) > 1000 {
		errors.Add("content", "Comment content cannot exceed 1000 characters")
	}

	return errors
}

// UserValidator validates user entities and related data
type UserValidator struct{}

// NewUserValidator creates a new user validator
func NewUserValidator() *UserValidator {
	return &UserValidator{}
}

// ValidateUserCreation validates data for user creation
func (v *UserValidator) ValidateUserCreation(email, name string) *MultiValidationError {
	errors := NewMultiValidationError()

	// Validate email
	trimmedEmail := strings.TrimSpace(strings.ToLower(email))
	if trimmedEmail == "" {
		errors.Add("email", "Email cannot be empty")
	} else if !emailRegex.MatchString(trimmedEmail) {
		errors.Add("email", "Invalid email format")
	}

	// Validate name
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		errors.Add("name", "Name cannot be empty")
	} else if len(trimmedName) > 100 {
		errors.Add("name", "Name cannot exceed 100 characters")
	}

	return errors
}

// ValidateUserUpdate validates data for user updates
func (v *UserValidator) ValidateUserUpdate(name string) *MultiValidationError {
	errors := NewMultiValidationError()

	// Validate name
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		errors.Add("name", "Name cannot be empty")
	} else if len(trimmedName) > 100 {
		errors.Add("name", "Name cannot exceed 100 characters")
	}

	return errors
}

// ValidateUserEntity validates an existing user entity for integrity
func (v *UserValidator) ValidateUserEntity(user *User) *MultiValidationError {
	errors := NewMultiValidationError()

	if user.ID == "" {
		errors.Add("id", "ID cannot be empty")
	}
	if user.Email == "" {
		errors.Add("email", "Email cannot be empty")
	}
	if !user.Role.IsValid() {
		errors.Add("role", "Invalid user role")
	}

	return errors
}

// ValidateRoleAssignment validates role assignment
func (v *UserValidator) ValidateRoleAssignment(role UserRole) *MultiValidationError {
	errors := NewMultiValidationError()

	if !role.IsValid() {
		errors.Add("role", "Invalid user role")
	}

	return errors
}

// GeographicValidator validates geographic data
type GeographicValidator struct{}

// NewGeographicValidator creates a new geographic validator
func NewGeographicValidator() *GeographicValidator {
	return &GeographicValidator{}
}

// ValidateBoundingBox validates a bounding box
func (v *GeographicValidator) ValidateBoundingBox(bbox *BoundingBox) *MultiValidationError {
	errors := NewMultiValidationError()

	if bbox == nil {
		return errors
	}

	// Validate latitude bounds
	if bbox.North < -90 || bbox.North > 90 {
		errors.Add("north", "North latitude must be between -90 and 90")
	}
	if bbox.South < -90 || bbox.South > 90 {
		errors.Add("south", "South latitude must be between -90 and 90")
	}
	if bbox.North <= bbox.South {
		errors.Add("bounding_box", "North latitude must be greater than south latitude")
	}

	// Validate longitude bounds
	if bbox.East < -180 || bbox.East > 180 {
		errors.Add("east", "East longitude must be between -180 and 180")
	}
	if bbox.West < -180 || bbox.West > 180 {
		errors.Add("west", "West longitude must be between -180 and 180")
	}

	return errors
}

// ValidatorSuite provides access to all validators
type ValidatorSuite struct {
	Trail      *TrailValidator
	Engagement *EngagementValidator
	User       *UserValidator
	Geographic *GeographicValidator
}

// NewValidatorSuite creates a new validator suite
func NewValidatorSuite() *ValidatorSuite {
	return &ValidatorSuite{
		Trail:      NewTrailValidator(),
		Engagement: NewEngagementValidator(),
		User:       NewUserValidator(),
		Geographic: NewGeographicValidator(),
	}
}