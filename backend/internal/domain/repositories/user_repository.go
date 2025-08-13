package repositories

import (
	"context"

	"bike-map-backend/internal/domain/entities"
)

// UserRepository defines the interface for user data access
type UserRepository interface {
	// Basic CRUD operations
	Create(ctx context.Context, user *entities.User) error
	GetByID(ctx context.Context, id string) (*entities.User, error)
	Update(ctx context.Context, user *entities.User) error
	Delete(ctx context.Context, id string) error
	
	// Query operations
	GetByEmail(ctx context.Context, email string) (*entities.User, error)
	GetByRole(ctx context.Context, role entities.UserRole) ([]*entities.User, error)
	GetVerified(ctx context.Context, limit, offset int) ([]*entities.User, error)
	GetUnverified(ctx context.Context, limit, offset int) ([]*entities.User, error)
	Search(ctx context.Context, query string) ([]*entities.User, error)
	List(ctx context.Context, limit, offset int) ([]*entities.User, error)
	
	// Existence checks
	Exists(ctx context.Context, id string) (bool, error)
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	
	// Statistics operations
	GetUserCount(ctx context.Context) (int, error)
	GetUserCountByRole(ctx context.Context, role entities.UserRole) (int, error)
	GetVerifiedUserCount(ctx context.Context) (int, error)
	
	// Batch operations
	GetByIDs(ctx context.Context, ids []string) ([]*entities.User, error)
}