package services

import (
	"fmt"
	"log"
	"sync"

	"bike-map-backend/entities"
	"bike-map-backend/interfaces"
)

// cacheEntry represents a cached tile with response data
type cacheEntry struct {
	Response []byte // MVT tile data
}

// MVTMemoryStorage implements MVTStorage as a memory cache
type MVTMemoryStorage struct {
	cache      map[string]*cacheEntry // Memory cache: "z-x-y" -> CacheEntry
	cacheMutex sync.RWMutex           // Thread-safe access to cache
	minZoom    int
	maxZoom    int
}

// NewMVTService creates a new MVT storage instance (memory cache)
func NewMVTService() *MVTMemoryStorage {
	return &MVTMemoryStorage{
		cache:   make(map[string]*cacheEntry),
		minZoom: 6,
		maxZoom: 18,
	}
}

func (m *MVTMemoryStorage) GetMinZoom() int {
	return m.minZoom
}

func (m *MVTMemoryStorage) GetMaxZoom() int {
	return m.maxZoom
}

// GetTile retrieves a tile from the cache
func (m *MVTMemoryStorage) GetTile(c entities.TileCoordinates) ([]byte, error) {
	if c.Z < m.minZoom || c.Z > m.maxZoom {
		return nil, fmt.Errorf("zoom level %d out of range [%d, %d]", c.Z, m.minZoom, m.maxZoom)
	}

	tileKey := fmt.Sprintf("%d-%d-%d", c.Z, c.X, c.Y)

	m.cacheMutex.RLock()
	entry, exists := m.cache[tileKey]
	m.cacheMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("tile %s not found in cache", tileKey)
	}

	return entry.Response, nil
}

// StoreTile stores a tile in the cache
func (m *MVTMemoryStorage) StoreTile(c entities.TileCoordinates, data []byte) error {
	tileKey := fmt.Sprintf("%d-%d-%d", c.Z, c.X, c.Y)

	m.cacheMutex.Lock()
	m.cache[tileKey] = &cacheEntry{
		Response: data,
	}
	m.cacheMutex.Unlock()

	return nil
}

// ClearTile removes a single tile from the cache
func (m *MVTMemoryStorage) ClearTile(c entities.TileCoordinates) error {
	tileKey := fmt.Sprintf("%d-%d-%d", c.Z, c.X, c.Y)

	m.cacheMutex.Lock()
	delete(m.cache, tileKey)
	m.cacheMutex.Unlock()

	return nil
}

// ClearAllTiles clears the entire cache
func (m *MVTMemoryStorage) ClearAllTiles() error {
	m.cacheMutex.Lock()
	defer m.cacheMutex.Unlock()

	cacheSize := len(m.cache)
	m.cache = make(map[string]*cacheEntry)
	log.Printf("Cleared entire MVT cache (%d tiles)", cacheSize)

	return nil
}

// Close is a no-op as MVTService is just a memory cache
func (m *MVTMemoryStorage) Close() error {
	return nil
}

// Compile-time check to ensure MVTService implements MVTStorage interface
var _ interfaces.MVTStorage = (*MVTMemoryStorage)(nil)
