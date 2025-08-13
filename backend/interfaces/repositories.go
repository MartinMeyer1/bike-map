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
	// Basic CRUD operations
	Create(ctx context.Context, rating *entities.Rating) error
	GetByID(ctx context.Context, id string) (*entities.Rating, error)
	Update(ctx context.Context, rating *entities.Rating) error
	Delete(ctx context.Context, id string) error

	// Query operations
	GetByTrail(ctx context.Context, trailID string) ([]*entities.Rating, error)
	GetByUser(ctx context.Context, userID string) ([]*entities.Rating, error)
	GetByUserAndTrail(ctx context.Context, userID, trailID string) (*entities.Rating, error)

	// Statistics operations
	GetAverageRating(ctx context.Context, trailID string) (float64, error)
	GetRatingCount(ctx context.Context, trailID string) (int, error)
	GetRatingDistribution(ctx context.Context, trailID string) (map[int]int, error)

	// Existence checks
	Exists(ctx context.Context, id string) (bool, error)
	UserHasRated(ctx context.Context, userID, trailID string) (bool, error)
}

// CommentRepository defines the interface for comment data access
type CommentRepository interface {
	// Basic CRUD operations
	Create(ctx context.Context, comment *entities.Comment) error
	GetByID(ctx context.Context, id string) (*entities.Comment, error)
	Update(ctx context.Context, comment *entities.Comment) error
	Delete(ctx context.Context, id string) error

	// Query operations
	GetByTrail(ctx context.Context, trailID string, limit, offset int) ([]*entities.Comment, error)
	GetByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Comment, error)
	GetRecent(ctx context.Context, limit int) ([]*entities.Comment, error)

	// Statistics operations
	GetCommentCount(ctx context.Context, trailID string) (int, error)
	GetTotalCommentCount(ctx context.Context) (int, error)

	// Existence checks
	Exists(ctx context.Context, id string) (bool, error)
}

// RatingAverageRepository defines the interface for rating average data access
type RatingAverageRepository interface {
	// Basic CRUD operations
	Create(ctx context.Context, ratingAverage *entities.RatingAverage) error
	GetByTrailID(ctx context.Context, trailID string) (*entities.RatingAverage, error)
	Update(ctx context.Context, ratingAverage *entities.RatingAverage) error
	Delete(ctx context.Context, trailID string) error

	// Batch operations
	GetByTrailIDs(ctx context.Context, trailIDs []string) ([]*entities.RatingAverage, error)

	// Statistics operations
	GetTopRatedTrails(ctx context.Context, limit int) ([]*entities.RatingAverage, error)

	// Existence checks
	Exists(ctx context.Context, trailID string) (bool, error)
}

// EngagementRepository combines all engagement-related repositories
type EngagementRepository interface {
	Ratings() RatingRepository
	Comments() CommentRepository
	RatingAverages() RatingAverageRepository

	// Aggregated operations across all engagement types
	GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error)
	GetEngagementStatsBatch(ctx context.Context, trailIDs []string) (map[string]*entities.EngagementStats, error)
}
