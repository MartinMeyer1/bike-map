package models

import (
	"encoding/json"
	"fmt"
	"time"
)

type TrailLevel string

const (
	LevelS0 TrailLevel = "S0"
	LevelS1 TrailLevel = "S1"
	LevelS2 TrailLevel = "S2"
	LevelS3 TrailLevel = "S3"
	LevelS4 TrailLevel = "S4"
	LevelS5 TrailLevel = "S5"
)

var ValidTrailLevels = []TrailLevel{
	LevelS0, LevelS1, LevelS2, LevelS3, LevelS4, LevelS5,
}

type Trail struct {
	ID          string     `json:"id"`
	Created     time.Time  `json:"created"`
	Updated     time.Time  `json:"updated"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Level       TrailLevel `json:"level"`
	Tags        []string   `json:"tags"`
	FileName    string     `json:"fileName"`
	FileSize    int64      `json:"fileSize"`
	OwnerID     string     `json:"ownerId"`
	Owner       *User      `json:"owner,omitempty"`
}

func (t *Trail) Validate() error {
	if t.Name == "" {
		return fmt.Errorf("trail name is required")
	}

	if len(t.Name) > 200 {
		return fmt.Errorf("trail name must be less than 200 characters")
	}

	if len(t.Description) > 1000 {
		return fmt.Errorf("trail description must be less than 1000 characters")
	}

	if !t.IsValidLevel() {
		return fmt.Errorf("invalid trail level: %s", t.Level)
	}

	if t.OwnerID == "" {
		return fmt.Errorf("trail owner is required")
	}

	return nil
}

func (t *Trail) IsValidLevel() bool {
	for _, level := range ValidTrailLevels {
		if t.Level == level {
			return true
		}
	}
	return false
}

func (t *Trail) MarshalTags() ([]byte, error) {
	return json.Marshal(t.Tags)
}

func (t *Trail) UnmarshalTags(data []byte) error {
	return json.Unmarshal(data, &t.Tags)
}

func NewTrail(name, description string, level TrailLevel, ownerID string) *Trail {
	return &Trail{
		Name:        name,
		Description: description,
		Level:       level,
		Tags:        make([]string, 0),
		OwnerID:     ownerID,
		Created:     time.Now(),
		Updated:     time.Now(),
	}
}