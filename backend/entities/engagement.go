package entities

import (
	"time"
)

// Rating represents a user's rating for a trail
type Rating struct {
	ID       string    `json:"id"`
	TrailID  string    `json:"trail_id"`
	UserID   string    `json:"user_id"`
	Rating   int       `json:"rating"` // 1-5 stars
	Created  time.Time `json:"created"`
	Updated  time.Time `json:"updated"`
}

// Comment represents a user's comment on a trail
type Comment struct {
	ID       string    `json:"id"`
	TrailID  string    `json:"trail_id"`
	UserID   string    `json:"user_id"`
	Content  string    `json:"content"`
	Created  time.Time `json:"created"`
	Updated  time.Time `json:"updated"`
}

// RatingAverage represents aggregated rating data for a trail
type RatingAverage struct {
	ID      string    `json:"id"`
	TrailID string    `json:"trail_id"`
	Average float64   `json:"average"` // 0.0-5.0
	Count   int       `json:"count"`   // Number of ratings
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// EngagementStats represents comprehensive engagement statistics for a trail
type EngagementStats struct {
	TrailID      string  `json:"trail_id"`
	RatingCount  int     `json:"rating_count"`
	RatingAvg    float64 `json:"rating_average"`
	CommentCount int     `json:"comment_count"`
	LastUpdated  time.Time `json:"last_updated"`
}

// NewRating creates a new rating
func NewRating(id, trailID, userID string, rating int) *Rating {
	now := time.Now()
	return &Rating{
		ID:      id,
		TrailID: trailID,
		UserID:  userID,
		Rating:  rating,
		Created: now,
		Updated: now,
	}
}

// NewComment creates a new comment
func NewComment(id, trailID, userID, content string) *Comment {
	now := time.Now()
	return &Comment{
		ID:      id,
		TrailID: trailID,
		UserID:  userID,
		Content: content,
		Created: now,
		Updated: now,
	}
}

// NewRatingAverage creates a new rating average entry
func NewRatingAverage(id, trailID string) *RatingAverage {
	now := time.Now()
	return &RatingAverage{
		ID:      id,
		TrailID: trailID,
		Average: 0.0,
		Count:   0,
		Created: now,
		Updated: now,
	}
}

// UpdateRating updates the rating value
func (r *Rating) UpdateRating(rating int) {
	r.Rating = rating
	r.Updated = time.Now()
}

// UpdateContent updates the comment content
func (c *Comment) UpdateContent(content string) {
	c.Content = content
	c.Updated = time.Now()
}

// UpdateStats updates the rating average statistics
func (ra *RatingAverage) UpdateStats(average float64, count int) {
	ra.Average = average
	ra.Count = count
	ra.Updated = time.Now()
}




// IsOwnedBy checks if the rating is owned by the given user
func (r *Rating) IsOwnedBy(userID string) bool {
	return r.UserID == userID
}

// IsOwnedBy checks if the comment is owned by the given user
func (c *Comment) IsOwnedBy(userID string) bool {
	return c.UserID == userID
}

// CanBeEditedBy checks if the comment can be edited by the given user
func (c *Comment) CanBeEditedBy(userID string, isAdmin bool) bool {
	return c.IsOwnedBy(userID) || isAdmin
}

// CanBeDeletedBy checks if the comment can be deleted by the given user
func (c *Comment) CanBeDeletedBy(userID string, isAdmin bool) bool {
	return c.IsOwnedBy(userID) || isAdmin
}