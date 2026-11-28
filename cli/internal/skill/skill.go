package skill

// guide.md is generated from skills/linkandroid-cli-skill/SKILL.md by
// scripts/sync-cli-skill.mjs. Edit the skill document, then run the script.

import (
	_ "embed"
	"strings"
)

//go:embed guide.md
var guide string

// Markdown returns the built-in usage guide without the leading YAML front matter.
func Markdown() string {
	s := strings.ReplaceAll(guide, "\r\n", "\n")
	if strings.HasPrefix(s, "---\n") {
		if idx := strings.Index(s[4:], "\n---"); idx >= 0 {
			s = strings.TrimLeft(s[4+idx+4:], "\n")
		}
	}
	return s
}
