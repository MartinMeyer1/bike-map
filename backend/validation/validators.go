package validation

import (
	"regexp"
	"strings"

	"bike-map-backend/entities"
)

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
func (v *TrailValidator) ValidateTrailCreation(name, description string, level entities.TrailLevel, tags []string) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

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

// ValidateElevationData validates elevation data
func (v *TrailValidator) ValidateElevationData(data *entities.ElevationData) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

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
func (v *EngagementValidator) ValidateRatingCreation(rating int) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

	if rating < 1 || rating > 5 {
		errors.Add("rating", "Rating must be between 1 and 5 stars")
	}

	return errors
}

// ValidateCommentCreation validates data for comment creation
func (v *EngagementValidator) ValidateCommentCreation(content string) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

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
func (v *UserValidator) ValidateUserCreation(email, name string) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

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
func (v *UserValidator) ValidateUserUpdate(name string) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

	// Validate name
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		errors.Add("name", "Name cannot be empty")
	} else if len(trimmedName) > 100 {
		errors.Add("name", "Name cannot exceed 100 characters")
	}

	return errors
}

// ValidateRoleAssignment validates role assignment
func (v *UserValidator) ValidateRoleAssignment(role entities.UserRole) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

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
func (v *GeographicValidator) ValidateBoundingBox(bbox *entities.BoundingBox) *entities.MultiValidationError {
	errors := entities.NewMultiValidationError()

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
