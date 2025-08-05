package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"bike-map-backend/internal/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// MVTHandler handles MVT-related HTTP requests
type MVTHandler struct {
	mvtService interfaces.MVTService
}

// NewMVTHandler creates a new MVT handler
func NewMVTHandler(mvtService interfaces.MVTService) *MVTHandler {
	return &MVTHandler{
		mvtService: mvtService,
	}
}

// SetupRoutes adds MVT endpoints to the router
func (h *MVTHandler) SetupRoutes(e *core.ServeEvent) {
	// Add OPTIONS handler for CORS preflight
	e.Router.OPTIONS("/api/mvt/trails", func(re *core.RequestEvent) error {
		h.setCORSHeaders(re)
		re.Response.WriteHeader(http.StatusOK)
		return nil
	})

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

	// Generate MVT
	log.Printf("Generating standard MVT for tile %d/%d/%d", z, x, y)
	mvtData, err := h.mvtService.GenerateTrailsMVT(z, x, y)
	if err != nil {
		log.Printf("Failed to generate MVT for tile %d/%d/%d: %v", z, x, y, err)
		re.Response.WriteHeader(http.StatusInternalServerError)
		re.Response.Write([]byte(fmt.Sprintf("Failed to generate tile: %v", err)))
		return nil
	}
	log.Printf("Generated standard MVT tile size: %d bytes", len(mvtData))

	// Set MVT headers
	h.setMVTHeaders(re, z, x, y)

	// Check if client has cached version
	if h.checkClientCache(re, z, x, y) {
		re.Response.WriteHeader(http.StatusNotModified)
		return nil
	}

	// Write MVT data
	re.Response.WriteHeader(http.StatusOK)
	re.Response.Write(mvtData)

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
	if z < 0 || z > 18 || x < 0 || y < 0 || x >= (1<<uint(z)) || y >= (1<<uint(z)) {
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

// setMVTHeaders sets MVT-specific headers including cache control and ETag
func (h *MVTHandler) setMVTHeaders(re *core.RequestEvent, z, x, y int) {
	// Set standard MVT headers
	re.Response.Header().Set("Content-Type", "application/vnd.mapbox-vector-tile")

	// Set proper caching headers for tiles
	re.Response.Header().Set("Cache-Control", "public, max-age=86400") // Cache for 24 hours

	// Generate ETag with cache version
	currentVersion := h.mvtService.GetCacheVersion()
	etag := fmt.Sprintf(`"mvt-v%s-%d-%d-%d"`, currentVersion, z, x, y)
	re.Response.Header().Set("ETag", etag)
}

// checkClientCache checks if the client has a valid cached version
func (h *MVTHandler) checkClientCache(re *core.RequestEvent, z, x, y int) bool {
	currentVersion := h.mvtService.GetCacheVersion()
	etag := fmt.Sprintf(`"mvt-v%s-%d-%d-%d"`, currentVersion, z, x, y)
	return re.Request.Header.Get("If-None-Match") == etag
}