package handlers

import (
	"log"
	"net/http"

	"bike-map-backend/internal/interfaces"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pocketbase/pocketbase/core"
)

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	authService interfaces.AuthService
}

// NewAuthHandler creates a new authentication handler
func NewAuthHandler(authService interfaces.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// SetupRoutes adds authentication endpoints to the router
func (h *AuthHandler) SetupRoutes(e *core.ServeEvent, app core.App) {
	// Add ForwardAuth validation endpoint
	e.Router.GET("/api/auth/validate", func(re *core.RequestEvent) error {
		return h.handleValidateAuth(re, app)
	})
}

// handleValidateAuth handles JWT token validation for ForwardAuth
func (h *AuthHandler) handleValidateAuth(re *core.RequestEvent, app core.App) error {
	// Get Authorization header
	authHeader := re.Request.Header.Get("Authorization")
	if authHeader == "" {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// Extract Bearer token
	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}
	tokenString := authHeader[7:]

	// Validate JWT token's signature
	_, err := app.FindAuthRecordByToken(tokenString)
	if err != nil {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// Parse the JWT token without verifying the signature (using ParseUnverified)
	token, _, err := jwt.NewParser().ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// Extract the user ID from the token claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// Get user id from the claim (ensure your JWT contains the "id" field)
	userID, ok := claims["id"].(string)
	log.Println("User ID from token:", userID)
	if !ok || userID == "" {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// Get the user from user id (look in users collection)
	user, err := app.FindRecordById("users", userID)
	if err != nil {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// Check if user has permission to create trails
	if !h.authService.CanCreateTrails(user) {
		re.Response.WriteHeader(http.StatusUnauthorized)
		return nil
	}

	// User is authorized
	re.Response.WriteHeader(http.StatusOK)
	return nil
}