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

// CanManageUsers checks if the role can moderate content
func (r UserRole) CanManageUsers() bool {
	return r == RoleAdmin
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

// CanManageUsers checks if the user can manage users
func (u *User) CanManageUsers() bool {
	return u.Role.CanManageUsers()
}
