package skill

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestGuideSyncedWithSkillFile keeps the embedded copy in sync with the skill document.
func TestGuideSyncedWithSkillFile(t *testing.T) {
	skillPath := filepath.Join("..", "..", "..", "skills", "linkandroid-cli-skill", "SKILL.md")
	raw, err := os.ReadFile(skillPath)
	if err != nil {
		t.Skipf("skill document not available: %v", err)
	}
	if string(raw) != guide {
		t.Fatal("cli/internal/skill/guide.md is out of sync; run: node scripts/sync-cli-skill.mjs")
	}
	if !strings.HasPrefix(Markdown(), "# ") {
		t.Fatal("Markdown() should start with the guide title, not the front matter")
	}
}
