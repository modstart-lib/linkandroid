package internal

import (
	"os"
	"path/filepath"
	"testing"
)

// TestDataDirPriority verifies dataRoot lookup: env > client.json dataRoot > default
func TestDataDirPriority(t *testing.T) {
	scratch := t.TempDir()
	os.Setenv("HOME", scratch)
	t.Cleanup(func() { os.Setenv("HOME", os.Getenv("ORIG_HOME")) })

	// T1: no env, no client.json -> default ~/.linkandroid/data
	os.Unsetenv("LINKANDROID_DATA_ROOT")
	dir, err := dataDir()
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	want := filepath.Join(scratch, ".linkandroid", "data")
	if dir != want {
		t.Errorf("T1 got %q want %q", dir, want)
	}

	// T2: client.json dataRoot custom
	clientDir := filepath.Join(scratch, ".linkandroid")
	os.MkdirAll(clientDir, 0755)
	os.WriteFile(filepath.Join(clientDir, "client.json"), []byte(`{"dataRoot":"~/custom/data"}`), 0644)
	dir, _ = dataDir()
	want = filepath.Join(scratch, "custom", "data")
	if dir != want {
		t.Errorf("T2 got %q want %q", dir, want)
	}

	// T3: env priority highest
	os.Setenv("LINKANDROID_DATA_ROOT", "/env/data/root")
	dir, _ = dataDir()
	if dir != "/env/data/root" {
		t.Errorf("T3 got %q want %q", dir, "/env/data/root")
	}
}
