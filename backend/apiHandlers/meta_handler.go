package apiHandlers

import (
	"fmt"
	"html"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// MetaHandler handles requests for trail sharing with Open Graph meta tags
type MetaHandler struct {
	app         core.App
	frontendURL string
}

// NewMetaHandler creates a new meta handler
func NewMetaHandler(app core.App) *MetaHandler {
	// Get frontend URL from environment, fallback to localhost for development
	frontendURL := os.Getenv("BASE_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	return &MetaHandler{
		app:         app,
		frontendURL: frontendURL,
	}
}

// HandleTrailShare generates an HTML page with Open Graph meta tags for trail sharing
func (h *MetaHandler) HandleTrailShare(re *core.RequestEvent) error {
	trailID := re.Request.PathValue("trailId")

	if trailID == "" {
		return re.String(http.StatusBadRequest, "Trail ID is required")
	}

	// Fetch trail from PocketBase
	trail, err := h.app.FindRecordById("trails", trailID)
	if err != nil {
		log.Printf("Failed to find trail %s: %v", trailID, err)
		return re.String(http.StatusNotFound, "Trail not found")
	}

	// Extract trail data
	trailName := trail.GetString("name")
	trailDescription := trail.GetString("description")
	trailLevel := trail.GetString("level")

	// Build descriptive meta content
	ogTitle := fmt.Sprintf("%s (%s) - BikeMap", html.EscapeString(trailName), html.EscapeString(trailLevel))

	ogDescription := html.EscapeString(trailDescription)
	if ogDescription == "" {
		ogDescription = fmt.Sprintf("Check out this %s MTB trail on BikeMap - Share and discover mountain bike singletracks!", html.EscapeString(trailLevel))
	}

	// Limit description length for social media
	if len(ogDescription) > 200 {
		ogDescription = ogDescription[:197] + "..."
	}

	// Build the share URL (will redirect to frontend with trail parameter)
	shareURL := fmt.Sprintf("%s?trail=%s", h.frontendURL, html.EscapeString(trailID))

	// Optional: Add image URL if available (you can add a default BikeMap logo)
	// Use API base URL from environment or default
	apiBaseURL := os.Getenv("VITE_API_BASE_URL")
	if apiBaseURL == "" {
		apiBaseURL = "http://localhost:8090"
	}
	ogImage := fmt.Sprintf("%s/favicon.svg", apiBaseURL)

	// Generate HTML with meta tags
	htmlContent := h.generateMetaHTML(ogTitle, ogDescription, shareURL, ogImage)

	// Set content type and return HTML
	re.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
	re.Response.WriteHeader(http.StatusOK)
	_, err = re.Response.Write([]byte(htmlContent))
	return err
}

// generateMetaHTML creates the HTML page with Open Graph meta tags and auto-redirect
func (h *MetaHandler) generateMetaHTML(title, description, url, image string) string {
	// Auto-redirect after a short delay (for web crawlers to read meta tags first)
	// Most social media crawlers don't execute JavaScript, but browsers will redirect
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="%s">
    <meta property="og:title" content="%s">
    <meta property="og:description" content="%s">
    <meta property="og:image" content="%s">
    <meta property="og:site_name" content="BikeMap">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="%s">
    <meta name="twitter:title" content="%s">
    <meta name="twitter:description" content="%s">
    <meta name="twitter:image" content="%s">

    <!-- WhatsApp optimizations -->
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Auto-redirect for browsers (not bots) -->
    <meta http-equiv="refresh" content="0; url=%s">
    <script>
        // Immediate redirect via JavaScript as well
        window.location.replace("%s");
    </script>

    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f8f9fa;
        }
        .loader {
            text-align: center;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #4F46E5;
            border-radius: 50%%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0%% { transform: rotate(0deg); }
            100%% { transform: rotate(360deg); }
        }
        a {
            color: #4F46E5;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="loader">
        <div class="spinner"></div>
        <p>Redirecting to BikeMap...</p>
        <p><a href="%s">Click here if you are not redirected automatically</a></p>
    </div>
</body>
</html>`,
		// All placeholders in order
		title,              // <title>
		url,                // og:url
		title,              // og:title
		description,        // og:description
		image,              // og:image
		url,                // twitter:url
		title,              // twitter:title
		description,        // twitter:description
		image,              // twitter:image
		url,                // meta refresh
		escapeJSString(url), // JavaScript redirect
		url,                // fallback link
	)
}

// escapeJSString escapes a string for use in JavaScript
func escapeJSString(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "'", "\\'")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	return s
}
