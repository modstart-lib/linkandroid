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
	DataRoot string `json:"dataRoot"`
}

// AuthConfig holds the port and token read from cli-auth.json
type AuthConfig struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

// defaultClientConfig returns the default ClientConfig.
func defaultClientConfig() ClientConfig {
	return ClientConfig{DataRoot: "~/.linkandroid/data"}
}

// readClientConfig reads LINKANDROID_DATA_ROOT env or ~/.linkandroid/client.json and returns dataDir.
// Priority: LINKANDROID_DATA_ROOT env > client.json dataRoot > default ~/.linkandroid/data.
// If client.json does not exist, it is auto-created with the default dataRoot.
func readClientConfig() (ClientConfig, error) {
	// 环境变量优先级最高
	if envDataRoot := os.Getenv("LINKANDROID_DATA_ROOT"); envDataRoot != "" {
		return ClientConfig{DataRoot: envDataRoot}, nil
	}

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
	if err := json.Unmarshal(data, &parsed); err == nil && parsed.DataRoot != "" {
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
	return expandPath(cfg.DataRoot), nil
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
