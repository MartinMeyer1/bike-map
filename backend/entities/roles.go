package entities

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
