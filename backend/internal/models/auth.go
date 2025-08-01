package models

import (
	"errors"
	"time"
)

var (
	ErrInvalidToken      = errors.New("invalid token")
	ErrTokenExpired      = errors.New("token expired")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrInsufficientRole  = errors.New("insufficient role permissions")
)

type AuthContext struct {
	User        *User     `json:"user"`
	Token       string    `json:"token"`
	ExpiresAt   time.Time `json:"expiresAt"`
	IssuedAt    time.Time `json:"issuedAt"`
	IsSuperuser bool      `json:"isSuperuser"`
}

func (a *AuthContext) IsValid() bool {
	return a.User != nil && a.Token != "" && time.Now().Before(a.ExpiresAt)
}

func (a *AuthContext) IsExpired() bool {
	return time.Now().After(a.ExpiresAt)
}

func (a *AuthContext) HasRole(role UserRole) bool {
	if a.User == nil {
		return false
	}
	
	switch role {
	case RoleAdmin:
		return a.User.IsAdmin() || a.IsSuperuser
	case RoleEditor:
		return a.User.IsEditor() || a.IsSuperuser
	case RoleViewer:
		return a.User.IsViewer() || a.IsSuperuser
	default:
		return false
	}
}

func (a *AuthContext) CanCreateTrails() bool {
	return a.HasRole(RoleEditor) || a.IsSuperuser
}

func (a *AuthContext) CanEditTrail(ownerID string) bool {
	if a.IsSuperuser || a.HasRole(RoleAdmin) {
		return true
	}
	return a.User != nil && a.User.ID == ownerID
}

func (a *AuthContext) CanDeleteTrail(ownerID string) bool {
	if a.IsSuperuser || a.HasRole(RoleAdmin) {
		return true
	}
	return a.User != nil && a.User.ID == ownerID
}

type Permission string

const (
	PermissionCreateTrail Permission = "create:trail"
	PermissionReadTrail   Permission = "read:trail"
	PermissionUpdateTrail Permission = "update:trail"
	PermissionDeleteTrail Permission = "delete:trail"
	PermissionManageUsers Permission = "manage:users"
)

func (a *AuthContext) HasPermission(permission Permission, resourceOwnerID ...string) bool {
	if a.IsSuperuser {
		return true
	}

	if a.User == nil {
		return false
	}

	switch permission {
	case PermissionCreateTrail:
		return a.CanCreateTrails()
	case PermissionReadTrail:
		return true // Public read access
	case PermissionUpdateTrail, PermissionDeleteTrail:
		if len(resourceOwnerID) > 0 {
			return a.CanEditTrail(resourceOwnerID[0])
		}
		return false
	case PermissionManageUsers:
		return a.HasRole(RoleAdmin)
	default:
		return false
	}
}