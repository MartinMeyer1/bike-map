package config

import (
	"fmt"
	"log"
	"os"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	OAuth    OAuthConfig
	Admin    AdminConfig
}

type ServerConfig struct {
	Port string
	Host string
	Dir  string
}

type DatabaseConfig struct {
	Dir string
}

type OAuthConfig struct {
	Google GoogleOAuthConfig
}

type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	Enabled      bool
}

type AdminConfig struct {
	Email    string
	Password string
}

func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port: getEnvOrDefault("PORT", "8090"),
			Host: getEnvOrDefault("HOST", "0.0.0.0"),
			Dir:  getEnvOrDefault("PB_DATA_DIR", "/pb_data"),
		},
		Database: DatabaseConfig{
			Dir: getEnvOrDefault("PB_DATA_DIR", "/pb_data"),
		},
		OAuth: OAuthConfig{
			Google: GoogleOAuthConfig{
				ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
				ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
			},
		},
		Admin: AdminConfig{
			Email:    os.Getenv("ADMIN_EMAIL"),
			Password: os.Getenv("ADMIN_PASSWORD"),
		},
	}

	// Set OAuth enabled flag
	cfg.OAuth.Google.Enabled = cfg.OAuth.Google.ClientID != "" && cfg.OAuth.Google.ClientSecret != ""

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.Server.Port == "" {
		return fmt.Errorf("server port is required")
	}
	
	if c.Server.Host == "" {
		return fmt.Errorf("server host is required")
	}

	if c.Database.Dir == "" {
		return fmt.Errorf("database directory is required")
	}

	return nil
}

func (c *Config) LogConfiguration() {
	log.Printf("📋 Configuration loaded:")
	log.Printf("   Server: %s:%s", c.Server.Host, c.Server.Port)
	log.Printf("   Data Dir: %s", c.Database.Dir)
	log.Printf("   Google OAuth: %t", c.OAuth.Google.Enabled)
	log.Printf("   Admin Account: %t", c.Admin.Email != "" && c.Admin.Password != "")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}