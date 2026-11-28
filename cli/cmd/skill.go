package cmd

import (
	"fmt"

	"linkandroid-cli/internal/skill"

	"github.com/spf13/cobra"
)

var skillCmd = &cobra.Command{
	Use:   "skill",
	Short: "Print the built-in usage guide",
	Long:  "Print the built-in usage guide (Markdown), including commands, examples and the HTTP API reference. Does not require LinkAndroid to be running.",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		_, err := fmt.Print(skill.Markdown())
		return err
	},
}
