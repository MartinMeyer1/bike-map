package interfaces

import (
	"context"

	"bike-map-backend/entities"
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

// RatingRepository defines the interface for rating data access
type RatingRepository interface {
	// Statistics operations
	GetAverageRating(ctx context.Context, trailID string) (float64, error)
	GetRatingCount(ctx context.Context, trailID string) (int, error)
}

// CommentRepository defines the interface for comment data access
type CommentRepository interface {
	// Statistics operations
	GetCommentCount(ctx context.Context, trailID string) (int, error)
}

// RatingAverageRepository defines the interface for rating average data access
type RatingAverageRepository interface {
	// Basic CRUD operations
	Create(ctx context.Context, ratingAverage *entities.RatingAverage) error
	GetByTrailID(ctx context.Context, trailID string) (*entities.RatingAverage, error)
	Update(ctx context.Context, ratingAverage *entities.RatingAverage) error
	Delete(ctx context.Context, trailID string) error
	Exists(ctx context.Context, trailID string) (bool, error)
}

// EngagementRepository combines all engagement-related repositories
type EngagementRepository interface {
	Ratings() RatingRepository
	Comments() CommentRepository
	RatingAverages() RatingAverageRepository

	// Aggregated operations across all engagement types
	GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error)
}
