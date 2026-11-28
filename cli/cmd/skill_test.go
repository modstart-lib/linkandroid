package cmd

import (
	"strings"
	"testing"

	"linkandroid-cli/internal/skill"

	"github.com/spf13/cobra"
)

// TestSkillGuideCoversCommands ensures every user-facing command is documented in the built-in guide.
func TestSkillGuideCoversCommands(t *testing.T) {
	doc := skill.Markdown()
	if strings.TrimSpace(doc) == "" {
		t.Fatal("skill guide is empty")
	}

	var walk func(c *cobra.Command)
	walk = func(c *cobra.Command) {
		for _, sub := range c.Commands() {
			if sub.Hidden || sub.Name() == "help" || sub.Name() == "completion" {
				continue
			}
			if len(sub.Commands()) > 0 {
				walk(sub)
				continue
			}
			path := sub.CommandPath()
			if !strings.Contains(doc, path) {
				t.Errorf("command %q is missing from the skill guide", path)
			}
		}
	}
	walk(rootCmd)
}
