package services

import (
	"fmt"

	"bike-map-backend/internal/config"
	"bike-map-backend/internal/models"

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
	role := models.UserRole(user.GetString("role"))
	return role.CanCreateTrails()
}

// CanManageUsers checks if the user has permission to manage other users
func (a *AuthService) CanManageUsers(user *core.Record) bool {
	role := models.UserRole(user.GetString("role"))
	return role.CanManageUsers()
}

// CanUpdateTrail checks if the user can update a specific trail
func (a *AuthService) CanUpdateTrail(user *core.Record, trail *core.Record) bool {
	userRole := models.UserRole(user.GetString("role"))
	
	// Admins can update any trail
	if userRole == models.RoleAdmin {
		return true
	}
	
	// Users can update their own trails
	return user.Id == trail.GetString("owner")
}

// CanDeleteTrail checks if the user can delete a specific trail
func (a *AuthService) CanDeleteTrail(user *core.Record, trail *core.Record) bool {
	return a.CanUpdateTrail(user, trail) // Same logic as update
}

// ValidateUserRole ensures the role is valid
func (a *AuthService) ValidateUserRole(role string) error {
	if !models.UserRole(role).IsValid() {
		return fmt.Errorf("invalid user role: %s", role)
	}
	return nil
}

// GetDefaultRole returns the default role for new users
func (a *AuthService) GetDefaultRole() string {
	return string(models.RoleViewer)
}