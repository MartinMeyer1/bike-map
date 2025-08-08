package interfaces

import "bike-map-backend/internal/models"

// MVTService defines the interface for MVT service operations
type MVTService interface {
	GenerateTrailsMVT(z, x, y int) ([]byte, error)
	GetTileCacheVersion(z, x, y int) string
	InvalidateTilesForTrail(trailBBox models.BoundingBox)
	InvalidateAllCache()
	GetCacheStats() map[string]interface{}
	Close() error
}