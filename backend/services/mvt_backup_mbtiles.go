package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"bike-map/entities"
	"bike-map/interfaces"

	_ "modernc.org/sqlite"
)

// MVTBackupMBTiles implements MVTBackup using in-memory SQLite with snapshot capability
type MVTBackupMBTiles struct {
	db          *sql.DB
	minZoom     int
	maxZoom     int
	mu          sync.RWMutex
	snapshotDir string
	dirty       atomic.Bool
}

// NewMVTBackupMBTiles creates a new in-memory MBTiles backup with snapshot capability
func NewMVTBackupMBTiles(snapshotDir string) (*MVTBackupMBTiles, error) {
	// Open IN-MEMORY SQLite database (zero disk I/O during tile generation)
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return nil, fmt.Errorf("failed to open in-memory database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to connect to in-memory database: %w", err)
	}

	m := &MVTBackupMBTiles{
		db:          db,
		minZoom:     6,
		maxZoom:     18,
		snapshotDir: snapshotDir,
	}

	// Initialize as dirty (will snapshot on first completion)
	m.dirty.Store(true)

	// Initialize schema
	if err := m.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize MBTiles schema: %w", err)
	}

	log.Printf("In-memory MBTiles backup initialized (snapshots to: %s)", snapshotDir)
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

	// Mark as dirty (tiles have changed)
	m.dirty.Store(true)

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

// Snapshot creates a disk snapshot of the in-memory database using VACUUM INTO
func (m *MVTBackupMBTiles) Snapshot() error {
	// Check if snapshot needed
	if !m.dirty.Load() {
		return nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Use snapshot directory from config
	targetDir := m.snapshotDir

	// Create directory if needed
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create snapshot directory: %w", err)
	}

	// Generate timestamped filename
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("bikemap-%d.mbtiles", timestamp)
	targetPath := targetDir + "/" + filename

	// Get tile count for logging
	var count int
	err := m.db.QueryRow("SELECT COUNT(*) FROM tiles").Scan(&count)
	if err != nil {
		log.Printf("Warning: Could not count tiles before snapshot: %v", err)
	}

	// VACUUM INTO creates compact snapshot
	_, err = m.db.Exec(fmt.Sprintf("VACUUM INTO '%s'", targetPath))
	if err != nil {
		return fmt.Errorf("failed to create snapshot: %w", err)
	}

	// Clear dirty flag
	m.dirty.Store(false)

	// Get snapshot file size
	fileInfo, _ := os.Stat(targetPath)
	var sizeStr string
	if fileInfo != nil {
		sizeMB := float64(fileInfo.Size()) / (1024 * 1024)
		sizeStr = fmt.Sprintf(" (%.2f MB)", sizeMB)
	}

	log.Printf("Snapshot created: %s - %d tiles%s", filename, count, sizeStr)

	// Cleanup old snapshots (older than 15 minutes)
	if err := m.cleanupOldSnapshots(targetDir, 15*time.Minute); err != nil {
		log.Printf("Warning: Failed to cleanup old snapshots: %v", err)
	}

	return nil
}

// cleanupOldSnapshots removes snapshot files older than maxAge
func (m *MVTBackupMBTiles) cleanupOldSnapshots(dir string, maxAge time.Duration) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	now := time.Now()
	cutoff := now.Add(-maxAge)
	var deletedCount int

	for _, entry := range entries {
		// Only process .mbtiles files
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".mbtiles") {
			continue
		}

		// Parse timestamp from filename (tiles-1703780425.mbtiles)
		if !strings.HasPrefix(entry.Name(), "tiles-") {
			continue
		}

		timestampStr := strings.TrimPrefix(entry.Name(), "tiles-")
		timestampStr = strings.TrimSuffix(timestampStr, ".mbtiles")

		timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
		if err != nil {
			log.Printf("Warning: Could not parse timestamp from %s: %v", entry.Name(), err)
			continue
		}

		fileTime := time.Unix(timestamp, 0)
		if fileTime.Before(cutoff) {
			filePath := filepath.Join(dir, entry.Name())
			if err := os.Remove(filePath); err != nil {
				log.Printf("Warning: Failed to delete old snapshot %s: %v", entry.Name(), err)
			} else {
				deletedCount++
				log.Printf("Deleted old snapshot: %s (age: %v)", entry.Name(), now.Sub(fileTime).Round(time.Second))
			}
		}
	}

	if deletedCount > 0 {
		log.Printf("Cleaned up %d old snapshot(s)", deletedCount)
	}

	return nil
}

// Compile-time check to ensure MVTBackupMBTiles implements MVTBackup interface
var _ interfaces.MVTBackup = (*MVTBackupMBTiles)(nil)
