package repositories

import (
	"context"
	"fmt"
	"strings"
	"time"

	"bike-map-backend/internal/domain/entities"
	"bike-map-backend/internal/domain/repositories"
	
	"github.com/pocketbase/pocketbase/core"
)

// PocketBaseEngagementRepository implements EngagementRepository using PocketBase
type PocketBaseEngagementRepository struct {
	app      core.App
	ratings  repositories.RatingRepository
	comments repositories.CommentRepository
	averages repositories.RatingAverageRepository
}

// NewPocketBaseEngagementRepository creates a new PocketBase engagement repository
func NewPocketBaseEngagementRepository(app core.App) repositories.EngagementRepository {
	return &PocketBaseEngagementRepository{
		app:      app,
		ratings:  NewPocketBaseRatingRepository(app),
		comments: NewPocketBaseCommentRepository(app),
		averages: NewPocketBaseRatingAverageRepository(app),
	}
}

// Ratings returns the rating repository
func (r *PocketBaseEngagementRepository) Ratings() repositories.RatingRepository {
	return r.ratings
}

// Comments returns the comment repository
func (r *PocketBaseEngagementRepository) Comments() repositories.CommentRepository {
	return r.comments
}

// RatingAverages returns the rating average repository
func (r *PocketBaseEngagementRepository) RatingAverages() repositories.RatingAverageRepository {
	return r.averages
}

// GetEngagementStats gets aggregated engagement statistics for a trail
func (r *PocketBaseEngagementRepository) GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error) {
	// Get rating statistics
	ratingCount, err := r.ratings.GetRatingCount(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get rating count: %w", err)
	}

	ratingAvg, err := r.ratings.GetAverageRating(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get average rating: %w", err)
	}

	// Get comment count
	commentCount, err := r.comments.GetCommentCount(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get comment count: %w", err)
	}

	return &entities.EngagementStats{
		TrailID:      trailID,
		RatingCount:  ratingCount,
		RatingAvg:    ratingAvg,
		CommentCount: commentCount,
		LastUpdated:  time.Now(),
	}, nil
}

// GetEngagementStatsBatch gets engagement statistics for multiple trails
func (r *PocketBaseEngagementRepository) GetEngagementStatsBatch(ctx context.Context, trailIDs []string) (map[string]*entities.EngagementStats, error) {
	result := make(map[string]*entities.EngagementStats)

	for _, trailID := range trailIDs {
		stats, err := r.GetEngagementStats(ctx, trailID)
		if err != nil {
			return nil, fmt.Errorf("failed to get engagement stats for trail %s: %w", trailID, err)
		}
		result[trailID] = stats
	}

	return result, nil
}

// PocketBaseRatingRepository implements RatingRepository using PocketBase
type PocketBaseRatingRepository struct {
	app core.App
}

// NewPocketBaseRatingRepository creates a new PocketBase rating repository
func NewPocketBaseRatingRepository(app core.App) repositories.RatingRepository {
	return &PocketBaseRatingRepository{
		app: app,
	}
}

// Create creates a new rating in PocketBase
func (r *PocketBaseRatingRepository) Create(ctx context.Context, rating *entities.Rating) error {
	collection, err := r.app.FindCollectionByNameOrId("trail_ratings")
	if err != nil {
		return fmt.Errorf("failed to find trail_ratings collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("trail", rating.TrailID)
	record.Set("user", rating.UserID)
	record.Set("rating", rating.Rating)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to create rating: %w", err)
	}

	rating.ID = record.Id
	return nil
}

// GetByID retrieves a rating by its ID
func (r *PocketBaseRatingRepository) GetByID(ctx context.Context, id string) (*entities.Rating, error) {
	record, err := r.app.FindRecordById("trail_ratings", id)
	if err != nil {
		return nil, fmt.Errorf("failed to find rating by ID: %w", err)
	}

	return r.recordToRating(record), nil
}

// Update updates a rating in PocketBase
func (r *PocketBaseRatingRepository) Update(ctx context.Context, rating *entities.Rating) error {
	record, err := r.app.FindRecordById("trail_ratings", rating.ID)
	if err != nil {
		return fmt.Errorf("failed to find rating for update: %w", err)
	}

	record.Set("rating", rating.Rating)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to update rating: %w", err)
	}

	return nil
}

// Delete deletes a rating from PocketBase
func (r *PocketBaseRatingRepository) Delete(ctx context.Context, id string) error {
	record, err := r.app.FindRecordById("trail_ratings", id)
	if err != nil {
		return fmt.Errorf("failed to find rating for deletion: %w", err)
	}

	if err := r.app.Delete(record); err != nil {
		return fmt.Errorf("failed to delete rating: %w", err)
	}

	return nil
}

// GetByTrail retrieves all ratings for a specific trail
func (r *PocketBaseRatingRepository) GetByTrail(ctx context.Context, trailID string) ([]*entities.Rating, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"trail = {:trail}",
		"-created",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find ratings by trail: %w", err)
	}

	return r.recordsToRatings(records), nil
}

// GetByUser retrieves all ratings by a specific user
func (r *PocketBaseRatingRepository) GetByUser(ctx context.Context, userID string) ([]*entities.Rating, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"user = {:user}",
		"-created",
		0,
		0,
		map[string]any{"user": userID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find ratings by user: %w", err)
	}

	return r.recordsToRatings(records), nil
}

// GetByUserAndTrail retrieves a specific user's rating for a trail
func (r *PocketBaseRatingRepository) GetByUserAndTrail(ctx context.Context, userID, trailID string) (*entities.Rating, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"user = {:user} && trail = {:trail}",
		"-created",
		1,
		0,
		map[string]any{"user": userID, "trail": trailID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find rating by user and trail: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("rating not found")
	}

	return r.recordToRating(records[0]), nil
}

// GetAverageRating calculates the average rating for a trail
func (r *PocketBaseRatingRepository) GetAverageRating(ctx context.Context, trailID string) (float64, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to find ratings for average: %w", err)
	}

	if len(records) == 0 {
		return 0, nil
	}

	var sum int
	for _, record := range records {
		sum += record.GetInt("rating")
	}

	return float64(sum) / float64(len(records)), nil
}

// GetRatingCount returns the number of ratings for a trail
func (r *PocketBaseRatingRepository) GetRatingCount(ctx context.Context, trailID string) (int, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count ratings: %w", err)
	}

	return len(records), nil
}

// GetRatingDistribution returns the distribution of ratings (1-5 stars) for a trail
func (r *PocketBaseRatingRepository) GetRatingDistribution(ctx context.Context, trailID string) (map[int]int, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get rating distribution: %w", err)
	}

	distribution := make(map[int]int)
	for i := 1; i <= 5; i++ {
		distribution[i] = 0
	}

	for _, record := range records {
		rating := record.GetInt("rating")
		if rating >= 1 && rating <= 5 {
			distribution[rating]++
		}
	}

	return distribution, nil
}

// Exists checks if a rating exists by ID
func (r *PocketBaseRatingRepository) Exists(ctx context.Context, id string) (bool, error) {
	_, err := r.app.FindRecordById("trail_ratings", id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check rating existence: %w", err)
	}
	return true, nil
}

// UserHasRated checks if a user has already rated a specific trail
func (r *PocketBaseRatingRepository) UserHasRated(ctx context.Context, userID, trailID string) (bool, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_ratings",
		"user = {:user} && trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"user": userID, "trail": trailID},
	)
	if err != nil {
		return false, fmt.Errorf("failed to check if user has rated: %w", err)
	}

	return len(records) > 0, nil
}

// recordToRating converts a PocketBase record to a Rating entity
func (r *PocketBaseRatingRepository) recordToRating(record *core.Record) *entities.Rating {
	return &entities.Rating{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		UserID:  record.GetString("user"),
		Rating:  record.GetInt("rating"),
		Created: record.GetDateTime("created").Time(),
		Updated: record.GetDateTime("updated").Time(),
	}
}

// recordsToRatings converts multiple PocketBase records to Rating entities
func (r *PocketBaseRatingRepository) recordsToRatings(records []*core.Record) []*entities.Rating {
	ratings := make([]*entities.Rating, len(records))
	for i, record := range records {
		ratings[i] = r.recordToRating(record)
	}
	return ratings
}

// PocketBaseCommentRepository implements CommentRepository using PocketBase
type PocketBaseCommentRepository struct {
	app core.App
}

// NewPocketBaseCommentRepository creates a new PocketBase comment repository
func NewPocketBaseCommentRepository(app core.App) repositories.CommentRepository {
	return &PocketBaseCommentRepository{
		app: app,
	}
}

// Create creates a new comment in PocketBase
func (r *PocketBaseCommentRepository) Create(ctx context.Context, comment *entities.Comment) error {
	collection, err := r.app.FindCollectionByNameOrId("trail_comments")
	if err != nil {
		return fmt.Errorf("failed to find trail_comments collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("trail", comment.TrailID)
	record.Set("user", comment.UserID)
	record.Set("content", comment.Content)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to create comment: %w", err)
	}

	comment.ID = record.Id
	return nil
}

// GetByID retrieves a comment by its ID
func (r *PocketBaseCommentRepository) GetByID(ctx context.Context, id string) (*entities.Comment, error) {
	record, err := r.app.FindRecordById("trail_comments", id)
	if err != nil {
		return nil, fmt.Errorf("failed to find comment by ID: %w", err)
	}

	return r.recordToComment(record), nil
}

// Update updates a comment in PocketBase
func (r *PocketBaseCommentRepository) Update(ctx context.Context, comment *entities.Comment) error {
	record, err := r.app.FindRecordById("trail_comments", comment.ID)
	if err != nil {
		return fmt.Errorf("failed to find comment for update: %w", err)
	}

	record.Set("content", comment.Content)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to update comment: %w", err)
	}

	return nil
}

// Delete deletes a comment from PocketBase
func (r *PocketBaseCommentRepository) Delete(ctx context.Context, id string) error {
	record, err := r.app.FindRecordById("trail_comments", id)
	if err != nil {
		return fmt.Errorf("failed to find comment for deletion: %w", err)
	}

	if err := r.app.Delete(record); err != nil {
		return fmt.Errorf("failed to delete comment: %w", err)
	}

	return nil
}

// GetByTrail retrieves comments for a specific trail with pagination
func (r *PocketBaseCommentRepository) GetByTrail(ctx context.Context, trailID string, limit, offset int) ([]*entities.Comment, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_comments",
		"trail = {:trail}",
		"-created",
		limit,
		offset,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find comments by trail: %w", err)
	}

	return r.recordsToComments(records), nil
}

// GetByUser retrieves comments by a specific user with pagination
func (r *PocketBaseCommentRepository) GetByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Comment, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_comments",
		"user = {:user}",
		"-created",
		limit,
		offset,
		map[string]any{"user": userID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find comments by user: %w", err)
	}

	return r.recordsToComments(records), nil
}

// GetRecent retrieves the most recent comments across all trails
func (r *PocketBaseCommentRepository) GetRecent(ctx context.Context, limit int) ([]*entities.Comment, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_comments",
		"",
		"-created",
		limit,
		0,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find recent comments: %w", err)
	}

	return r.recordsToComments(records), nil
}

// GetCommentCount returns the number of comments for a trail
func (r *PocketBaseCommentRepository) GetCommentCount(ctx context.Context, trailID string) (int, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_comments",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count comments: %w", err)
	}

	return len(records), nil
}

// GetTotalCommentCount returns the total number of comments across all trails
func (r *PocketBaseCommentRepository) GetTotalCommentCount(ctx context.Context) (int, error) {
	records, err := r.app.FindRecordsByFilter(
		"trail_comments",
		"",
		"",
		0,
		0,
		nil,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count total comments: %w", err)
	}

	return len(records), nil
}

// Exists checks if a comment exists by ID
func (r *PocketBaseCommentRepository) Exists(ctx context.Context, id string) (bool, error) {
	_, err := r.app.FindRecordById("trail_comments", id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check comment existence: %w", err)
	}
	return true, nil
}

// recordToComment converts a PocketBase record to a Comment entity
func (r *PocketBaseCommentRepository) recordToComment(record *core.Record) *entities.Comment {
	return &entities.Comment{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		UserID:  record.GetString("user"),
		Content: record.GetString("content"),
		Created: record.GetDateTime("created").Time(),
		Updated: record.GetDateTime("updated").Time(),
	}
}

// recordsToComments converts multiple PocketBase records to Comment entities
func (r *PocketBaseCommentRepository) recordsToComments(records []*core.Record) []*entities.Comment {
	comments := make([]*entities.Comment, len(records))
	for i, record := range records {
		comments[i] = r.recordToComment(record)
	}
	return comments
}

// PocketBaseRatingAverageRepository implements RatingAverageRepository using PocketBase
type PocketBaseRatingAverageRepository struct {
	app core.App
}

// NewPocketBaseRatingAverageRepository creates a new PocketBase rating average repository
func NewPocketBaseRatingAverageRepository(app core.App) repositories.RatingAverageRepository {
	return &PocketBaseRatingAverageRepository{
		app: app,
	}
}

// Create creates a new rating average entry in PocketBase
func (r *PocketBaseRatingAverageRepository) Create(ctx context.Context, ratingAverage *entities.RatingAverage) error {
	collection, err := r.app.FindCollectionByNameOrId("rating_average")
	if err != nil {
		return fmt.Errorf("failed to find rating_average collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("trail", ratingAverage.TrailID)
	record.Set("average", ratingAverage.Average)
	record.Set("count", ratingAverage.Count)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to create rating average: %w", err)
	}

	ratingAverage.ID = record.Id
	return nil
}

// GetByTrailID retrieves the rating average for a specific trail
func (r *PocketBaseRatingAverageRepository) GetByTrailID(ctx context.Context, trailID string) (*entities.RatingAverage, error) {
	records, err := r.app.FindRecordsByFilter(
		"rating_average",
		"trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find rating average by trail ID: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("rating average not found for trail: %s", trailID)
	}

	return r.recordToRatingAverage(records[0]), nil
}

// Update updates a rating average entry in PocketBase
func (r *PocketBaseRatingAverageRepository) Update(ctx context.Context, ratingAverage *entities.RatingAverage) error {
	record, err := r.app.FindRecordById("rating_average", ratingAverage.ID)
	if err != nil {
		return fmt.Errorf("failed to find rating average for update: %w", err)
	}

	record.Set("average", ratingAverage.Average)
	record.Set("count", ratingAverage.Count)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to update rating average: %w", err)
	}

	return nil
}

// Delete deletes a rating average entry from PocketBase
func (r *PocketBaseRatingAverageRepository) Delete(ctx context.Context, trailID string) error {
	records, err := r.app.FindRecordsByFilter(
		"rating_average",
		"trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return fmt.Errorf("failed to find rating average for deletion: %w", err)
	}

	if len(records) == 0 {
		return fmt.Errorf("rating average not found for trail: %s", trailID)
	}

	if err := r.app.Delete(records[0]); err != nil {
		return fmt.Errorf("failed to delete rating average: %w", err)
	}

	return nil
}

// GetByTrailIDs retrieves rating averages for multiple trails
func (r *PocketBaseRatingAverageRepository) GetByTrailIDs(ctx context.Context, trailIDs []string) ([]*entities.RatingAverage, error) {
	if len(trailIDs) == 0 {
		return []*entities.RatingAverage{}, nil
	}

	var conditions []string
	params := make(map[string]any)
	
	for i, trailID := range trailIDs {
		paramKey := fmt.Sprintf("trail%d", i)
		conditions = append(conditions, fmt.Sprintf("trail = {:"+paramKey+"}"))
		params[paramKey] = trailID
	}
	
	filter := strings.Join(conditions, " || ")

	records, err := r.app.FindRecordsByFilter(
		"rating_average",
		filter,
		"",
		0,
		0,
		params,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find rating averages by trail IDs: %w", err)
	}

	return r.recordsToRatingAverages(records), nil
}

// GetTopRatedTrails retrieves the trails with the highest average ratings
func (r *PocketBaseRatingAverageRepository) GetTopRatedTrails(ctx context.Context, limit int) ([]*entities.RatingAverage, error) {
	records, err := r.app.FindRecordsByFilter(
		"rating_average",
		"count > 0", // Only include trails with at least one rating
		"-average, -count",
		limit,
		0,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find top rated trails: %w", err)
	}

	return r.recordsToRatingAverages(records), nil
}

// Exists checks if a rating average exists for a specific trail
func (r *PocketBaseRatingAverageRepository) Exists(ctx context.Context, trailID string) (bool, error) {
	records, err := r.app.FindRecordsByFilter(
		"rating_average",
		"trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return false, fmt.Errorf("failed to check rating average existence: %w", err)
	}

	return len(records) > 0, nil
}

// recordToRatingAverage converts a PocketBase record to a RatingAverage entity
func (r *PocketBaseRatingAverageRepository) recordToRatingAverage(record *core.Record) *entities.RatingAverage {
	return &entities.RatingAverage{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		Average: record.GetFloat("average"),
		Count:   record.GetInt("count"),
		Created: record.GetDateTime("created").Time(),
		Updated: record.GetDateTime("updated").Time(),
	}
}

// recordsToRatingAverages converts multiple PocketBase records to RatingAverage entities
func (r *PocketBaseRatingAverageRepository) recordsToRatingAverages(records []*core.Record) []*entities.RatingAverage {
	averages := make([]*entities.RatingAverage, len(records))
	for i, record := range records {
		averages[i] = r.recordToRatingAverage(record)
	}
	return averages
}