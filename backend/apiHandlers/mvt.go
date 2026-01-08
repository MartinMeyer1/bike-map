package apiHandlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"bike-map/entities"
	"bike-map/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// TileJSON represents a TileJSON 3.0.0 document
type TileJSON struct {
	TileJSON     string         `json:"tilejson"`
	Name         string         `json:"name,omitempty"`
	Description  string         `json:"description,omitempty"`
	Version      string         `json:"version,omitempty"`
	Attribution  string         `json:"attribution,omitempty"`
	Scheme       string         `json:"scheme"`
	Tiles        []string       `json:"tiles"`
	MinZoom      int            `json:"minzoom"`
	MaxZoom      int            `json:"maxzoom"`
	FillZoom     int            `json:"fillzoom,omitempty"`
	Bounds       []float64      `json:"bounds,omitempty"`
	Center       []float64      `json:"center,omitempty"`
	VectorLayers []VectorLayer  `json:"vector_layers"`
}

// VectorLayer represents a vector layer in TileJSON
type VectorLayer struct {
	ID          string            `json:"id"`
	Description string            `json:"description,omitempty"`
	MinZoom     int               `json:"minzoom,omitempty"`
	MaxZoom     int               `json:"maxzoom,omitempty"`
	Fields      map[string]string `json:"fields"`
}

// MVTHandler handles MVT-related HTTP requests
type MVTHandler struct {
	cache interfaces.MVTCache
}

// NewMVTHandler creates a new MVT handler
func NewMVTHandler(cache interfaces.MVTCache) *MVTHandler {
	return &MVTHandler{
		cache: cache,
	}
}

// SetupRoutes adds MVT endpoints to the router
func (h *MVTHandler) SetupRoutes(e *core.ServeEvent) {
	// TileJSON metadata endpoint
	e.Router.GET("/api/tiles.json", func(re *core.RequestEvent) error {
		return h.handleTileJSON(re)
	})

	// Add standard MVT endpoints using wildcard pattern since PocketBase doesn't support multi-level parameters
	// Support standard path format /api/tiles/{z}/{x}/{y}.mvt
	e.Router.GET("/api/tiles/{path...}", func(re *core.RequestEvent) error {
		return h.handleMVTRequestWithPath(re)
	})
}

// handleMVTRequestWithPath handles MVT requests using wildcard path parsing
func (h *MVTHandler) handleMVTRequestWithPath(re *core.RequestEvent) error {
	h.setCORSHeaders(re)

	// Parse path: /api/tiles/{z}/{x}/{y}.mvt
	pathParam := re.Request.PathValue("path")
	pathParam = strings.TrimSuffix(pathParam, ".mvt")
	pathParam = strings.TrimSuffix(pathParam, ".pbf")

	parts := strings.Split(pathParam, "/")
	if len(parts) != 3 {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte("Invalid path format. Expected: /api/tiles/{z}/{x}/{y}.mvt"))
		return nil
	}

	z, x, y, err := h.parseCoordinates(parts)
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte(err.Error()))
		return nil
	}

	if err := h.validateTileCoordinates(z, x, y); err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte(err.Error()))
		return nil
	}

	coords := entities.TileCoordinates{X: x, Y: y, Z: z}

	// Get tile from cache (handles generation logic internally)
	data, err := h.cache.GetTile(context.Background(), coords)
	if err != nil {
		re.Response.WriteHeader(http.StatusBadRequest)
		re.Response.Write([]byte(err.Error()))
		return nil
	}

	if len(data) == 0 {
		re.Response.WriteHeader(http.StatusNoContent)
		return nil
	}

	h.setMVTHeaders(re)
	re.Response.WriteHeader(http.StatusOK)
	re.Response.Write(data)
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

// buildBaseURL constructs the base URL for tile requests
func (h *MVTHandler) buildBaseURL(re *core.RequestEvent) string {
	// Use BASE_URL env var if set (for production)
	if baseURL := os.Getenv("BASE_URL"); baseURL != "" {
		return strings.TrimSuffix(baseURL, "/")
	}

	// Static default for development (not request-based)
	return "http://localhost:8090"
}

// handleTileJSON returns TileJSON metadata for the tile service
func (h *MVTHandler) handleTileJSON(re *core.RequestEvent) error {
	h.setCORSHeaders(re)

	// Build base URL from environment variable
	baseURL := h.buildBaseURL(re)

	tileJSON := TileJSON{
		TileJSON:    "3.0.0",
		Name:        "Bike Map Trails",
		Description: "Mountain bike trail data with difficulty levels and metadata",
		Version:     "1.0.0",
		Scheme:      "xyz",
		Tiles: []string{
			fmt.Sprintf("%s/api/tiles/{z}/{x}/{y}.mvt", baseURL),
		},
		MinZoom:  h.cache.GetMinZoom(),
		MaxZoom:  h.cache.GetMaxZoom(),
		FillZoom: 18,
		VectorLayers: []VectorLayer{
			{
				ID:          "trails",
				Description: "Mountain bike trail lines",
				MinZoom:     h.cache.GetMinZoom(),
				MaxZoom:     h.cache.GetMaxZoom(),
				Fields: map[string]string{
					"id":                    "Trail unique identifier",
					"name":                  "Trail name",
					"description":           "Trail description",
					"level":                 "Difficulty level (S0-S5)",
					"tags":                  "Comma-separated tags",
					"owner_id":              "Trail owner ID",
					"distance_m":            "Trail length in meters",
					"elevation_gain_meters": "Total elevation gain",
					"elevation_loss_meters": "Total elevation loss",
					"rating_average":        "Average rating (0-5)",
					"rating_count":          "Number of ratings",
					"comment_count":         "Number of comments",
					"ridden":                "Trail has been ridden",
					"bbox_west":             "Bounding box west",
					"bbox_south":            "Bounding box south",
					"bbox_east":             "Bounding box east",
					"bbox_north":            "Bounding box north",
				},
			},
			{
				ID:          "trailpoints",
				Description: "Trail start and end points",
				MinZoom:     h.cache.GetMinZoom(),
				MaxZoom:     h.cache.GetMaxZoom(),
				Fields: map[string]string{
					"id":         "Point unique identifier (trail_id-type)",
					"trail_id":   "Associated trail ID",
					"trail_name": "Trail name",
					"point_type": "Point type (start or end)",
				},
			},
		},
	}

	return re.JSON(http.StatusOK, tileJSON)
}
