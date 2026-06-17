package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ClientConfig represents ~/.linkandroid/client.json
type ClientConfig struct {
	DataPath string `json:"dataPath"`
}

// AuthConfig holds the port and token read from cli-auth.json
type AuthConfig struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

// defaultClientConfig returns the default ClientConfig.
func defaultClientConfig() ClientConfig {
	return ClientConfig{DataPath: "~/.linkandroid/data"}
}

// readClientConfig reads ~/.linkandroid/client.json and returns dataDir.
// If the file does not exist, it is auto-created with the default dataPath.
func readClientConfig() (ClientConfig, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return defaultClientConfig(), err
	}
	clientPath := filepath.Join(home, ".linkandroid", "client.json")

	// 默认值
	cfg := defaultClientConfig()

	data, err := os.ReadFile(clientPath)
	if err != nil {
		if os.IsNotExist(err) {
			// 自动创建 client.json
			clientDir := filepath.Dir(clientPath)
			if mkErr := os.MkdirAll(clientDir, 0755); mkErr == nil {
				writeData, _ := json.MarshalIndent(cfg, "", "  ")
				_ = os.WriteFile(clientPath, writeData, 0644)
			}
		}
		return cfg, nil
	}

	var parsed ClientConfig
	if err := json.Unmarshal(data, &parsed); err == nil && parsed.DataPath != "" {
		cfg = parsed
	}
	return cfg, nil
}

// dataDir returns LinkAndroid's shared data directory by reading client.json.
func dataDir() (string, error) {
	cfg, err := readClientConfig()
	if err != nil {
		return "", err
	}
	return expandPath(cfg.DataPath), nil
}

// expandPath expands ~ to the user's home directory.
func expandPath(p string) string {
	if strings.HasPrefix(p, "~") {
		home, err := os.UserHomeDir()
		if err == nil {
			return filepath.Join(home, strings.TrimPrefix(p, "~"))
		}
	}
	return p
}

// LoadAuthConfig reads cli-auth.json from the LinkAndroid data directory.
func LoadAuthConfig() (*AuthConfig, error) {
	dir, err := dataDir()
	if err != nil {
		return nil, fmt.Errorf("cannot determine data directory: %w", err)
	}
	filePath := filepath.Join(dir, "cli-auth.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("cannot read %s: %w (is LinkAndroid running?)", filePath, err)
	}
	var cfg AuthConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("invalid cli-auth.json: %w", err)
	}
	if cfg.Port == 0 || cfg.Token == "" {
		return nil, fmt.Errorf("cli-auth.json is incomplete (port=%d, token empty=%v)", cfg.Port, cfg.Token == "")
	}
	return &cfg, nil
}
