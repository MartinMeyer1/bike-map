package interfaces

import "github.com/pocketbase/pocketbase/core"

// Auth defines the interface for authentication operations
type Auth interface {
	CanCreateTrails(user *core.Record) bool
	CanManageUsers(user *core.Record) bool
	GetDefaultRole() string
}
