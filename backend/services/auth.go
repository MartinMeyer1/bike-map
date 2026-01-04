package services

import (
	"bike-map/config"
	"bike-map/entities"

	"github.com/pocketbase/pocketbase/core"
)

// AuthService handles authentication and authorization logic
type AuthService struct {
	config *config.Config
}

// NewAuthService creates a new authentication service
func NewAuthService(cfg *config.Config) *AuthService {
	return &AuthService{
		config: cfg,
	}
}

// CanCreateTrails checks if the user has permission to create trails
func (a *AuthService) CanCreateTrails(user *core.Record) bool {
	role := entities.UserRole(user.GetString("role"))
	return role.CanCreateTrails()
}

// CanManageUsers checks if the user has permission to manage other users
func (a *AuthService) CanManageUsers(user *core.Record) bool {
	role := entities.UserRole(user.GetString("role"))
	return role.CanManageUsers()
}

// GetDefaultRole returns the default role for new users
func (a *AuthService) GetDefaultRole() string {
	return string(entities.RoleViewer)
}
