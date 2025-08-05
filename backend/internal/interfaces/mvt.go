package interfaces

// MVTService defines the interface for MVT service operations
type MVTService interface {
	GenerateTrailsMVT(z, x, y int) ([]byte, error)
	GetCacheVersion() string
	InvalidateCache()
	Close() error
}