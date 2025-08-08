package models

// UserRole represents available user roles
type UserRole string

const (
	RoleViewer UserRole = "Viewer"
	RoleEditor UserRole = "Editor"
	RoleAdmin  UserRole = "Admin"
)

// IsValidRole checks if the role is valid
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

// CanManageUsers checks if the role can manage other users
func (r UserRole) CanManageUsers() bool {
	return r == RoleAdmin
}