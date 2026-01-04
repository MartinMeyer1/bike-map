package apiHandlers

import (
	"bike-map/entities"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

type SnapshotInfo struct {
	Filename  string    `json:"filename"`
	Timestamp int64     `json:"timestamp"`
	SizeBytes int64     `json:"size_bytes"`
	SizeMB    float64   `json:"size_mb"`
	CreatedAt time.Time `json:"created_at"`
}

type MBTilesHandler struct {
	snapshotDir string
}

func NewMBTilesHandler(snapshotDir string) *MBTilesHandler {
	return &MBTilesHandler{
		snapshotDir: snapshotDir,
	}
}

func (h *MBTilesHandler) SetupRoutes(e *core.ServeEvent) {
	e.Router.GET("/api/mbtiles/latest", h.HandleLatest)
	e.Router.GET("/api/mbtiles/download/latest", h.HandleDownloadLatest)
	e.Router.GET("/api/mbtiles/download/{filename}", h.HandleDownload)
}

func (h *MBTilesHandler) HandleLatest(re *core.RequestEvent) error {
	// Set CORS headers
	re.Response.Header().Set("Access-Control-Allow-Origin", "*")

	// Find latest snapshot
	snapshot, err := h.getLatestSnapshot()
	if err != nil {
		log.Printf("Error finding latest snapshot: %v", err)
		return re.JSON(http.StatusNotFound, map[string]string{"error": "No snapshots available"})
	}

	return re.JSON(http.StatusOK, snapshot)
}

func (h *MBTilesHandler) HandleDownloadLatest(re *core.RequestEvent) error {
	// Find latest snapshot
	snapshot, err := h.getLatestSnapshot()
	if err != nil {
		log.Printf("Error finding latest snapshot: %v", err)
		return re.String(http.StatusNotFound, "No snapshots available")
	}

	// Download the latest file
	filePath := filepath.Join(h.snapshotDir, snapshot.Filename)

	// Open file
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("Error opening file %s: %v", snapshot.Filename, err)
		return re.String(http.StatusInternalServerError, "Failed to open file")
	}
	defer file.Close()

	// Set headers
	re.Response.Header().Set("Content-Type", "application/x-mbtiles")
	re.Response.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, snapshot.Filename))
	re.Response.Header().Set("Content-Length", fmt.Sprintf("%d", snapshot.SizeBytes))
	re.Response.Header().Set("Access-Control-Allow-Origin", "*")

	// Stream file to client
	re.Response.WriteHeader(http.StatusOK)
	_, err = io.Copy(re.Response, file)
	if err != nil {
		log.Printf("Error streaming file %s: %v", snapshot.Filename, err)
	}

	return nil
}

func (h *MBTilesHandler) HandleDownload(re *core.RequestEvent) error {
	filename := re.Request.PathValue("filename")

	// Validate filename
	if !h.isValidFilename(filename) {
		return re.String(http.StatusBadRequest, "Invalid filename")
	}

	// Build full path
	filePath := filepath.Join(h.snapshotDir, filename)

	// Security: ensure resolved path is still within snapshot directory
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return re.String(http.StatusBadRequest, "Invalid path")
	}

	absDir, err := filepath.Abs(h.snapshotDir)
	if err != nil {
		return re.String(http.StatusInternalServerError, "Server configuration error")
	}

	if !strings.HasPrefix(absPath, absDir) {
		return re.String(http.StatusForbidden, "Access denied")
	}

	// Check if file exists
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return re.String(http.StatusNotFound, "File not found")
	}

	// Open file
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("Error opening file %s: %v", filename, err)
		return re.String(http.StatusInternalServerError, "Failed to open file")
	}
	defer file.Close()

	// Set headers
	re.Response.Header().Set("Content-Type", "application/x-mbtiles")
	re.Response.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	re.Response.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
	re.Response.Header().Set("Access-Control-Allow-Origin", "*")

	// Stream file to client
	re.Response.WriteHeader(http.StatusOK)
	_, err = io.Copy(re.Response, file)
	if err != nil {
		log.Printf("Error streaming file %s: %v", filename, err)
	}

	return nil
}

// getLatestSnapshot finds the most recent snapshot in the directory
func (h *MBTilesHandler) getLatestSnapshot() (*SnapshotInfo, error) {
	entries, err := os.ReadDir(h.snapshotDir)
	if err != nil {
		return nil, err
	}

	var snapshots []SnapshotInfo

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".mbtiles") {
			continue
		}

		// Parse timestamp from filename (bikemap-1703780425.mbtiles)
		if !strings.HasPrefix(entry.Name(), entities.MBtilesFilePrefix) {
			continue
		}

		timestampStr := strings.TrimPrefix(entry.Name(), entities.MBtilesFilePrefix)
		timestampStr = strings.TrimSuffix(timestampStr, ".mbtiles")

		timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
		if err != nil {
			log.Printf("Warning: Could not parse timestamp from %s: %v", entry.Name(), err)
			continue
		}

		// Get file info
		filePath := filepath.Join(h.snapshotDir, entry.Name())
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		snapshots = append(snapshots, SnapshotInfo{
			Filename:  entry.Name(),
			Timestamp: timestamp,
			SizeBytes: fileInfo.Size(),
			SizeMB:    float64(fileInfo.Size()) / (1024 * 1024),
			CreatedAt: time.Unix(timestamp, 0),
		})
	}

	if len(snapshots) == 0 {
		return nil, fmt.Errorf("no snapshots found")
	}

	// Sort by timestamp descending (newest first)
	sort.Slice(snapshots, func(i, j int) bool {
		return snapshots[i].Timestamp > snapshots[j].Timestamp
	})

	return &snapshots[0], nil
}

// isValidFilename validates that filename matches expected pattern
func (h *MBTilesHandler) isValidFilename(filename string) bool {
	// Must match pattern: bikemap-<digits>.mbtiles
	matched, _ := regexp.MatchString(`^` + entities.MBtilesFilePrefix + `\d+\.mbtiles$`, filename)
	return matched
}
