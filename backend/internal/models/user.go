package models

import (
	"time"
)

type UserRole string

const (
	RoleViewer UserRole = "Viewer"
	RoleEditor UserRole = "Editor"
	RoleAdmin  UserRole = "Admin"
)

type User struct {
	ID        string    `json:"id"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatarUrl"`
	Role      UserRole  `json:"role"`
	Verified  bool      `json:"verified"`
}

func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

func (u *User) IsEditor() bool {
	return u.Role == RoleEditor || u.Role == RoleAdmin
}

func (u *User) IsViewer() bool {
	return u.Role == RoleViewer || u.Role == RoleEditor || u.Role == RoleAdmin
}

func (u *User) CanCreateTrails() bool {
	return u.IsEditor()
}

func (u *User) CanEditTrail(ownerID string) bool {
	return u.ID == ownerID || u.IsAdmin()
}

func (u *User) CanDeleteTrail(ownerID string) bool {
	return u.ID == ownerID || u.IsAdmin()
}

func (u *User) CanChangeRole() bool {
	return u.IsAdmin()
}

func NewUser(email, name string) *User {
	return &User{
		Email:    email,
		Name:     name,
		Username: email,
		Role:     RoleViewer, // Default role
		Created:  time.Now(),
		Updated:  time.Now(),
	}
}