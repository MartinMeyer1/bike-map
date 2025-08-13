package entities

import (
	"time"
)

// UserRole represents the role of a user in the system
type UserRole string

const (
	RoleViewer UserRole = "Viewer"
	RoleEditor UserRole = "Editor"
	RoleAdmin  UserRole = "Admin"
)

// IsValid checks if the user role is valid
func (r UserRole) IsValid() bool {
	switch r {
	case RoleViewer, RoleEditor, RoleAdmin:
		return true
	default:
		return false
	}
}

// CanCreateTrails checks if the role can create trails
func (r UserRole) CanCreateTrails() bool {
	return r == RoleEditor || r == RoleAdmin
}

// CanModerateContent checks if the role can moderate content
func (r UserRole) CanModerateContent() bool {
	return r == RoleAdmin
}

// CanEditTrails checks if the role can edit trails
func (r UserRole) CanEditTrails() bool {
	return r == RoleEditor || r == RoleAdmin
}

// User represents a user in the system
type User struct {
	ID       string    `json:"id"`
	Email    string    `json:"email"`
	Name     string    `json:"name"`
	Avatar   string    `json:"avatar"`
	Role     UserRole  `json:"role"`
	Created  time.Time `json:"created"`
	Updated  time.Time `json:"updated"`
	Verified bool      `json:"verified"`
}

// NewUser creates a new user with default role
func NewUser(id, email, name string) *User {
	now := time.Now()
	return &User{
		ID:       id,
		Email:    email,
		Name:     name,
		Role:     RoleViewer, // Default role
		Created:  now,
		Updated:  now,
		Verified: false,
	}
}

// UpdateProfile updates user profile information
func (u *User) UpdateProfile(name, avatar string) {
	u.Name = name
	u.Avatar = avatar
	u.Updated = time.Now()
}

// SetRole updates the user's role
func (u *User) SetRole(role UserRole) {
	u.Role = role
	u.Updated = time.Now()
}

// Verify marks the user as verified
func (u *User) Verify() {
	u.Verified = true
	u.Updated = time.Now()
}


// IsAdmin checks if the user is an administrator
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// IsEditor checks if the user is an editor or admin
func (u *User) IsEditor() bool {
	return u.Role == RoleEditor || u.Role == RoleAdmin
}

// IsViewer checks if the user is at least a viewer
func (u *User) IsViewer() bool {
	return u.Role.IsValid() // All valid roles include viewer permissions
}

// CanCreateTrails checks if the user can create trails
func (u *User) CanCreateTrails() bool {
	return u.Role.CanCreateTrails()
}

// CanModerateContent checks if the user can moderate content
func (u *User) CanModerateContent() bool {
	return u.Role.CanModerateContent()
}

// CanEditTrail checks if the user can edit a specific trail
func (u *User) CanEditTrail(trail *Trail) bool {
	return u.IsAdmin() || (u.IsEditor() && trail.IsOwnedBy(u.ID))
}

// CanDeleteTrail checks if the user can delete a specific trail
func (u *User) CanDeleteTrail(trail *Trail) bool {
	return u.IsAdmin() || trail.IsOwnedBy(u.ID)
}