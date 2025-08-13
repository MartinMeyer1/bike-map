package repositories

import (
	"context"

	"bike-map-backend/internal/domain/entities"
)

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