package apiHandlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"bike-map/entities"
	"bike-map/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// MVTHandler handles MVT-related HTTP requests
type MVTHandler struct {
	cache         interfaces.MVTCache
	tileRequester interfaces.TileRequester
}

// NewMVTHandler creates a new MVT handler
func NewMVTHandler(cache interfaces.MVTCache, tileRequester interfaces.TileRequester) *MVTHandler {
	return &MVTHandler{
		cache:         cache,
		tileRequester: tileRequester,
	}
}

// SetupRoutes adds MVT endpoints to the router
func (h *MVTHandler) SetupRoutes(e *core.ServeEvent) {
	// Add standard MVT endpoints using wildcard pattern since PocketBase doesn't support multi-level parameters
	// Support standard path format /api/tiles/{z}/{x}/{y}.mvt
	e.Router.GET("/api/tiles/{path...}", func(re *core.RequestEvent) error {
		return h.handleMVTRequestWithPath(re)
	})
}

// handleMVTRequestWithPath handles MVT requests using wildcard path parsing
func (h *MVTHandler) handleMVTRequestWithPath(re *core.RequestEvent) error {
	// Set CORS headers first
	h.setCORSHeaders(re)

	// Extract path from wildcard parameter
	pathParam := re.Request.PathValue("path")

	// Remove file extensions (.mvt, .pbf)
	pathParam = strings.TrimSuffix(pathParam, ".mvt")
	pathParam = strings.TrimSuffix(pathParam, ".pbf")

	// Split path into z/x/y components
	parts := strings.Split(pathParam, "/")
	if len(parts) != 3 {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid path format. Expected: /api/tiles/{z}/{x}/{y}.mvt"))
		return nil
	}

	// Parse coordinates
	z, x, y, err := h.parseCoordinates(parts)
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte(err.Error()))
		return nil
	}

	// Validate tile coordinates
	if err := h.validateTileCoordinates(z, x, y); err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte(err.Error()))
		return nil
	}

	coords := entities.TileCoordinates{X: x, Y: y, Z: z}

	// Get tile with status from storage
	data, status, err := h.cache.GetTileWithStatus(coords)
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte(err.Error()))
		return nil
	}

	switch status {
	case interfaces.TileValid:
		// Tile is valid, return it
		h.setMVTHeaders(re)
		re.Response.WriteHeader(http.StatusOK)
		re.Response.Write(data)
		return nil

	case interfaces.TileEmpty:
		// Tile was generated but has no trails
		re.Response.WriteHeader(http.StatusNoContent)
		return nil

	case interfaces.TileInvalidated, interfaces.TileNotFound:
		// Tile needs generation - request priority generation
		newData, err := h.tileRequester.RequestTile(coords)
		if err != nil {
			// Timeout - return stale data if available (invalidated case)
			if status == interfaces.TileInvalidated && len(data) > 0 {
				h.setMVTHeaders(re)
				re.Response.WriteHeader(http.StatusOK)
				re.Response.Write(data)
				return nil
			}
			// No data available
			re.Response.WriteHeader(http.StatusNoContent)
			return nil
		}

		// Check if the generated tile is empty
		if len(newData) == 0 {
			re.Response.WriteHeader(http.StatusNoContent)
			return nil
		}

		// Return the freshly generated tile
		h.setMVTHeaders(re)
		re.Response.WriteHeader(http.StatusOK)
		re.Response.Write(newData)
		return nil
	}

	// Fallback
	re.Response.WriteHeader(http.StatusNoContent)
	return nil
}

// parseCoordinates parses z, x, y coordinates from path parts
func (h *MVTHandler) parseCoordinates(parts []string) (z, x, y int, err error) {
	z, err = strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid zoom level")
	}

	x, err = strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid x coordinate")
	}

	y, err = strconv.Atoi(parts[2])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid y coordinate")
	}

	return z, x, y, nil
}

// validateTileCoordinates validates tile coordinates
func (h *MVTHandler) validateTileCoordinates(z, x, y int) error {
	if z < h.cache.GetMinZoom() || z > h.cache.GetMaxZoom() || x < 0 || y < 0 || x >= (1<<uint(z)) || y >= (1<<uint(z)) {
		return fmt.Errorf("invalid tile coordinates")
	}
	return nil
}

// setCORSHeaders sets CORS headers for cross-origin requests
func (h *MVTHandler) setCORSHeaders(re *core.RequestEvent) {
	re.Response.Header().Set("Access-Control-Allow-Origin", "*")
	re.Response.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	re.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

// setMVTHeaders sets MVT-specific headers including cache control
func (h *MVTHandler) setMVTHeaders(re *core.RequestEvent) {
	// Set standard MVT headers
	re.Response.Header().Set("Content-Type", "application/vnd.mapbox-vector-tile")

	// Set proper caching headers for tiles
	re.Response.Header().Set("Cache-Control", "public, max-age=86400") // Cache for 24 hours
}
