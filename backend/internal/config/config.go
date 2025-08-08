package config

import (
	"log"
	"os"
	"strconv"
)

// Config holds all application configuration
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	OAuth    OAuthConfig
	Admin    AdminConfig
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	BaseURL string
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	Host     string
	Port     int
	Database string
	User     string
	Password string
}

// OAuthConfig holds OAuth provider configuration
type OAuthConfig struct {
	Google GoogleOAuthConfig
}

// GoogleOAuthConfig holds Google OAuth specific configuration
type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
}

// AdminConfig holds admin account configuration
type AdminConfig struct {
	Email    string
	Password string
}

// Load reads configuration from environment variables with sensible defaults
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			BaseURL: getEnv("BASE_URL", "http://localhost:8090"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("POSTGRES_HOST", "localhost"),
			Port:     getEnvInt("POSTGRES_PORT", 5432),
			Database: getEnv("POSTGRES_DB", "gis"),
			User:     getEnv("POSTGRES_USER", "gisuser"),
			Password: getEnv("POSTGRES_PASSWORD", "gispass"),
		},
		OAuth: OAuthConfig{
			Google: GoogleOAuthConfig{
				ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
				ClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
			},
		},
		Admin: AdminConfig{
			Email:    getEnv("ADMIN_EMAIL", ""),
			Password: getEnv("ADMIN_PASSWORD", ""),
		},
	}
}

// getEnv gets an environment variable with a fallback default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt gets an integer environment variable with a fallback default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
		log.Printf("Warning: Invalid integer value for %s: %s, using default %d", key, value, defaultValue)
	}
	return defaultValue
}

// Validate checks if required configuration values are present
func (c *Config) Validate() error {
	// Add validation logic if needed
	return nil
}