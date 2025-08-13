package types

import (
	"bike-map-backend/entities"

	"github.com/google/uuid"
)

// Event types for users
const (
	UserCreatedEvent     = "user.created"
	UserUpdatedEvent     = "user.updated"
	UserVerifiedEvent    = "user.verified"
	UserRoleChangedEvent = "user.role_changed"
)

// UserCreated represents a user creation event
type UserCreated struct {
	BaseEvent
	User *entities.User `json:"user"`
}

// UserUpdated represents a user update event
type UserUpdated struct {
	BaseEvent
	User     *entities.User `json:"user"`
	Previous *entities.User `json:"previous,omitempty"`
}

// UserVerified represents a user verification event
type UserVerified struct {
	BaseEvent
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

// UserRoleChanged represents a user role change event
type UserRoleChanged struct {
	BaseEvent
	UserID       string            `json:"user_id"`
	NewRole      entities.UserRole `json:"new_role"`
	PreviousRole entities.UserRole `json:"previous_role"`
}

// NewUserCreated creates a new user created event
func NewUserCreated(user *entities.User) *UserCreated {
	return &UserCreated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			UserCreatedEvent,
			user.ID,
			user,
		),
		User: user,
	}
}

// NewUserUpdated creates a new user updated event
func NewUserUpdated(user, previous *entities.User) *UserUpdated {
	return &UserUpdated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			UserUpdatedEvent,
			user.ID,
			user,
		),
		User:     user,
		Previous: previous,
	}
}

// NewUserVerified creates a new user verified event
func NewUserVerified(userID, email string) *UserVerified {
	return &UserVerified{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			UserVerifiedEvent,
			userID,
			map[string]string{
				"user_id": userID,
				"email":   email,
			},
		),
		UserID: userID,
		Email:  email,
	}
}

// NewUserRoleChanged creates a new user role changed event
func NewUserRoleChanged(userID string, newRole, previousRole entities.UserRole) *UserRoleChanged {
	return &UserRoleChanged{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			UserRoleChangedEvent,
			userID,
			map[string]interface{}{
				"user_id":       userID,
				"new_role":      newRole,
				"previous_role": previousRole,
			},
		),
		UserID:       userID,
		NewRole:      newRole,
		PreviousRole: previousRole,
	}
}
