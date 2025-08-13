package interfaces

import "github.com/pocketbase/pocketbase/core"

// AuthService defines the interface for authentication operations
type AuthService interface {
	CanCreateTrails(user *core.Record) bool
	CanManageUsers(user *core.Record) bool
	CanUpdateTrail(user *core.Record, trail *core.Record) bool
	CanDeleteTrail(user *core.Record, trail *core.Record) bool
	ValidateUserRole(role string) error
	GetDefaultRole() string
}