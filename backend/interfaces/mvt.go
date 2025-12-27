package interfaces

import (
	"context"

	"bike-map/entities"
)

// TileStatus represents the state of a cached tile
type TileStatus int

const (
	TileNotFound    TileStatus = iota // Never generated
	TileEmpty                         // Generated but no trails
	TileValid                         // Has valid data
	TileInvalidated                   // Needs regeneration
)

// MVTProvider - base interface for MVT operations (read-only)
type MVTProvider interface {
	GetTile(ctx context.Context, c entities.TileCoordinates) ([]byte, error)
	GetMinZoom() int
	GetMaxZoom() int
	Close() error
}

// MVTCache - in-memory tile cache with status tracking
type MVTCache interface {
	MVTProvider
	StoreTile(c entities.TileCoordinates, data []byte) error
	ClearAllTiles() error

	// Tile status methods
	GetTileWithStatus(c entities.TileCoordinates) ([]byte, TileStatus, error)
	InvalidateTiles(tiles []entities.TileCoordinates) error
}

// MVTBackup - backup storage for tiles (e.g., mbtiles)
type MVTBackup interface {
	MVTProvider
	StoreTile(c entities.TileCoordinates, data []byte) error
	ClearAllTiles() error
}

// MVTGenerator - generates MVT tiles and manages trail data
type MVTGenerator interface {
	MVTProvider
	CreateTrail(ctx context.Context, trail entities.Trail) error
	UpdateTrail(ctx context.Context, trail entities.Trail) error
	DeleteTrail(ctx context.Context, trailID string) error
	ClearAllTrails(ctx context.Context) error

	GetTrailTiles(ctx context.Context, trailID string) ([]entities.TileCoordinates, error)
}

// TileRequester - requests priority tile generation (used by handlers)
type TileRequester interface {
	RequestTile(coords entities.TileCoordinates) ([]byte, error)
}
