package entities

// Rating represents a user's rating for a trail
type Rating struct {
	ID       string    `json:"id"`
	TrailID  string    `json:"trail_id"`
	UserID   string    `json:"user_id"`
	Rating   int       `json:"rating"` // 1-5 stars
}

// Comment represents a user's comment on a trail
type Comment struct {
	ID       string    `json:"id"`
	TrailID  string    `json:"trail_id"`
	UserID   string    `json:"user_id"`
	Content  string    `json:"content"`
}

// RatingAverage represents aggregated rating data for a trail
type RatingAverage struct {
	ID      string    `json:"id"`
	TrailID string    `json:"trail_id"`
	Average float64   `json:"average"` // 0.0-5.0
	Count   int       `json:"count"`   // Number of ratings
}

// EngagementStats represents comprehensive engagement statistics for a trail
type EngagementStats struct {
	TrailID      string  `json:"trail_id"`
	RatingCount  int     `json:"rating_count"`
	RatingAvg    float64 `json:"rating_average"`
	CommentCount int     `json:"comment_count"`
}

// NewRatingAverage creates a new rating average entry
func NewRatingAverage(id, trailID string) *RatingAverage {
	return &RatingAverage{
		ID:      id,
		TrailID: trailID,
		Average: 0.0,
		Count:   0,
	}
}

// UpdateStats updates the rating average statistics
func (ra *RatingAverage) UpdateStats(average float64, count int) {
	ra.Average = average
	ra.Count = count
}

// EngagementStatsData contains engagement statistics for updating
type EngagementStatsData struct {
	RatingAvg    float64
	RatingCount  int
	CommentCount int
}