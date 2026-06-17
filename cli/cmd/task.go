package cmd

import (
	"fmt"
	"linkandroid-cli/internal"
	"strconv"

	"github.com/spf13/cobra"
)

var taskCmd = &cobra.Command{
	Use:   "task",
	Short: "Manage and run tasks",
}

var taskListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all tasks",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/task/list", map[string]any{})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}

var taskGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get task details by ID",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/task/get", map[string]any{"id": args[0]})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}

var taskRunCmd = &cobra.Command{
	Use:   "run <id>",
	Short: "Run a task manually by ID",
	Long:  "Execute a task immediately and return the run log.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid task id: %s", args[0])
		}
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/task/run", map[string]any{"id": id})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}

var taskHistoryCmd = &cobra.Command{
	Use:   "history <id>",
	Short: "List run history for a task",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/task/history", map[string]any{"id": args[0]})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}

func init() {
	taskCmd.AddCommand(taskListCmd)
	taskCmd.AddCommand(taskGetCmd)
	taskCmd.AddCommand(taskRunCmd)
	taskCmd.AddCommand(taskHistoryCmd)
	rootCmd.AddCommand(taskCmd)
}
