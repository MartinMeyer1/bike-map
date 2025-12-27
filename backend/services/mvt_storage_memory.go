package services

import (
	"context"
	"fmt"
	"log"
	"sync"

	"bike-map/entities"
	"bike-map/interfaces"
)

// cacheEntry represents a cached tile with response data and status
type cacheEntry struct {
	data   []byte              // MVT tile data
	status interfaces.TileStatus
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
func (m *MVTMemoryStorage) GetTile(_ context.Context, c entities.TileCoordinates) ([]byte, error) {
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

	return entry.data, nil
}

// GetTileWithStatus retrieves a tile and its status from the cache
func (m *MVTMemoryStorage) GetTileWithStatus(c entities.TileCoordinates) ([]byte, interfaces.TileStatus, error) {
	if c.Z < m.minZoom || c.Z > m.maxZoom {
		return nil, interfaces.TileNotFound, fmt.Errorf("zoom level %d out of range [%d, %d]", c.Z, m.minZoom, m.maxZoom)
	}

	tileKey := fmt.Sprintf("%d-%d-%d", c.Z, c.X, c.Y)

	m.cacheMutex.RLock()
	entry, exists := m.cache[tileKey]
	m.cacheMutex.RUnlock()

	if !exists {
		return nil, interfaces.TileNotFound, nil
	}

	return entry.data, entry.status, nil
}

// StoreTile stores a tile in the cache with appropriate status
func (m *MVTMemoryStorage) StoreTile(c entities.TileCoordinates, data []byte) error {
	tileKey := fmt.Sprintf("%d-%d-%d", c.Z, c.X, c.Y)

	status := interfaces.TileValid
	if len(data) == 0 {
		status = interfaces.TileEmpty
	}

	m.cacheMutex.Lock()
	m.cache[tileKey] = &cacheEntry{
		data:   data,
		status: status,
	}
	m.cacheMutex.Unlock()

	return nil
}

// InvalidateTiles marks multiple tiles as needing regeneration
func (m *MVTMemoryStorage) InvalidateTiles(tiles []entities.TileCoordinates) error {
	m.cacheMutex.Lock()
	for _, c := range tiles {
		tileKey := fmt.Sprintf("%d-%d-%d", c.Z, c.X, c.Y)
		if entry, exists := m.cache[tileKey]; exists {
			entry.status = interfaces.TileInvalidated
		}else{
			m.cache[tileKey] = &cacheEntry{
				data: []byte{},
				status: interfaces.TileInvalidated,
			}
		}
	}
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

// Compile-time check to ensure MVTMemoryStorage implements MVTCache interface
var _ interfaces.MVTCache = (*MVTMemoryStorage)(nil)
