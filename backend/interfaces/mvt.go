package interfaces

import "bike-map-backend/entities"

// MVTService defines the interface for MVT service operations
type MVTService interface {
	GenerateTrailsMVT(z, x, y int) ([]byte, error)
	GetTileCacheVersion(z, x, y int) string
	InvalidateTilesForTrail(trailBBox entities.BoundingBox)
	InvalidateAllCache()
	GetCacheStats() map[string]interface{}
	Close() error
}
