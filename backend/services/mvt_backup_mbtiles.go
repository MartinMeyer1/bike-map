package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"bike-map/entities"
	"bike-map/interfaces"

	_ "modernc.org/sqlite"
)

// MVTBackupMBTiles implements MVTBackup using MBTiles (SQLite) format
type MVTBackupMBTiles struct {
	db      *sql.DB
	minZoom int
	maxZoom int
	mu      sync.RWMutex
}

// NewMVTBackupMBTiles creates a new MBTiles backup storage
func NewMVTBackupMBTiles(path string) (*MVTBackupMBTiles, error) {
	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// Open or create SQLite database
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open MBTiles database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to connect to MBTiles database: %w", err)
	}

	m := &MVTBackupMBTiles{
		db:      db,
		minZoom: 6,
		maxZoom: 18,
	}

	// Initialize schema
	if err := m.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize MBTiles schema: %w", err)
	}

	log.Printf("MBTiles backup initialized at %s", path)
	return m, nil
}

// initSchema creates the MBTiles schema if it doesn't exist
func (m *MVTBackupMBTiles) initSchema() error {
	// Create metadata table
	_, err := m.db.Exec(`
		CREATE TABLE IF NOT EXISTS metadata (
			name TEXT,
			value TEXT
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create metadata table: %w", err)
	}

	// Create tiles table
	_, err = m.db.Exec(`
		CREATE TABLE IF NOT EXISTS tiles (
			zoom_level INTEGER,
			tile_column INTEGER,
			tile_row INTEGER,
			tile_data BLOB
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create tiles table: %w", err)
	}

	// Create unique index on tiles
	_, err = m.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS tile_index
		ON tiles (zoom_level, tile_column, tile_row)
	`)
	if err != nil {
		return fmt.Errorf("failed to create tiles index: %w", err)
	}

	// Insert/update required metadata
	metadata := map[string]string{
		"name":    "bike-map-trails",
		"format":  "pbf",
		"minzoom": fmt.Sprintf("%d", m.minZoom),
		"maxzoom": fmt.Sprintf("%d", m.maxZoom),
		"type":    "overlay",
	}

	for name, value := range metadata {
		_, err = m.db.Exec(`
			INSERT OR REPLACE INTO metadata (name, value) VALUES (?, ?)
		`, name, value)
		if err != nil {
			return fmt.Errorf("failed to set metadata %s: %w", name, err)
		}
	}

	return nil
}

// xyzToTMS converts XYZ tile coordinates to TMS coordinates
// TMS Y is flipped: tms_y = 2^zoom - 1 - xyz_y
func xyzToTMS(z, y int) int {
	return (1 << z) - 1 - y
}

// GetTile retrieves a tile from MBTiles storage
func (m *MVTBackupMBTiles) GetTile(_ context.Context, c entities.TileCoordinates) ([]byte, error) {
	if c.Z < m.minZoom || c.Z > m.maxZoom {
		return nil, fmt.Errorf("zoom level %d out of range [%d, %d]", c.Z, m.minZoom, m.maxZoom)
	}

	tmsY := xyzToTMS(c.Z, c.Y)

	m.mu.RLock()
	defer m.mu.RUnlock()

	var data []byte
	err := m.db.QueryRow(`
		SELECT tile_data FROM tiles
		WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?
	`, c.Z, c.X, tmsY).Scan(&data)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query tile: %w", err)
	}

	return data, nil
}

// StoreTile stores a tile in MBTiles storage
func (m *MVTBackupMBTiles) StoreTile(c entities.TileCoordinates, data []byte) error {
	tmsY := xyzToTMS(c.Z, c.Y)

	m.mu.Lock()
	defer m.mu.Unlock()

	_, err := m.db.Exec(`
		INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data)
		VALUES (?, ?, ?, ?)
	`, c.Z, c.X, tmsY, data)

	if err != nil {
		return fmt.Errorf("failed to store tile: %w", err)
	}

	return nil
}

// ClearAllTiles removes all tiles from storage
func (m *MVTBackupMBTiles) ClearAllTiles() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	result, err := m.db.Exec(`DELETE FROM tiles`)
	if err != nil {
		return fmt.Errorf("failed to clear tiles: %w", err)
	}

	count, _ := result.RowsAffected()
	log.Printf("Cleared %d tiles from MBTiles backup", count)

	return nil
}

// GetMinZoom returns the minimum zoom level
func (m *MVTBackupMBTiles) GetMinZoom() int {
	return m.minZoom
}

// GetMaxZoom returns the maximum zoom level
func (m *MVTBackupMBTiles) GetMaxZoom() int {
	return m.maxZoom
}

// Close closes the database connection
func (m *MVTBackupMBTiles) Close() error {
	log.Println("Closing MBTiles backup")
	return m.db.Close()
}

// Compile-time check to ensure MVTBackupMBTiles implements MVTBackup interface
var _ interfaces.MVTBackup = (*MVTBackupMBTiles)(nil)
