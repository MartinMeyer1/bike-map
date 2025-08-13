package repositories

import (
	"context"

	"bike-map-backend/internal/domain/entities"
)

// TrailRepository defines the interface for trail data access
type TrailRepository interface {
	// Basic CRUD operations
	Create(ctx context.Context, trail *entities.Trail) error
	GetByID(ctx context.Context, id string) (*entities.Trail, error)
	Update(ctx context.Context, trail *entities.Trail) error
	Delete(ctx context.Context, id string) error
	
	// Query operations
	GetByOwner(ctx context.Context, ownerID string) ([]*entities.Trail, error)
	GetByLevel(ctx context.Context, level entities.TrailLevel) ([]*entities.Trail, error)
	GetByTags(ctx context.Context, tags []string) ([]*entities.Trail, error)
	Search(ctx context.Context, query string) ([]*entities.Trail, error)
	List(ctx context.Context, limit, offset int) ([]*entities.Trail, error)
	
	// Existence checks
	Exists(ctx context.Context, id string) (bool, error)
	ExistsByName(ctx context.Context, name string, excludeID string) (bool, error)
	
	// Batch operations
	GetByIDs(ctx context.Context, ids []string) ([]*entities.Trail, error)
	CreateBatch(ctx context.Context, trails []*entities.Trail) error
}