const versions = [
    {
        version: 0,
        up: async (db: DB) => {},
    },
    {
        version: 1,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS task (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                code TEXT NOT NULL DEFAULT '',
                language TEXT NOT NULL DEFAULT 'python'
            )`)
            await db.execute(`CREATE TABLE IF NOT EXISTS task_run (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                task_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                log TEXT DEFAULT '',
                started_at TEXT,
                finished_at TEXT,
                FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE
            )`)
        },
    },
    {
        version: 2,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE task_run ADD COLUMN device_id TEXT DEFAULT ''`)
        },
    },
    {
        version: 3,
        up: async (db: DB) => {
            // Rename legacy script tables to task tables for existing databases
            const tables = await db.first("SELECT name FROM sqlite_master WHERE type='table' AND name='script'")
            if (tables) {
                await db.execute(`ALTER TABLE script RENAME TO task`)
                await db.execute(`ALTER TABLE script_run RENAME TO task_run`)
                // Rename column script_id to task_id in task_run
                await db.execute(`ALTER TABLE task_run RENAME COLUMN script_id TO task_id`)
            }
        },
    },
    {
        version: 4,
        up: async (db: DB) => {
            // Add cron scheduling columns to task table
            const columns = await db.select('PRAGMA table_info(task)')
            const hasRunMode = columns.some((c: any) => c.name === 'run_mode')
            const hasCronExpression = columns.some((c: any) => c.name === 'cron_expression')
            if (!hasRunMode) {
                await db.execute(`ALTER TABLE task ADD COLUMN run_mode TEXT NOT NULL DEFAULT 'manual'`)
            }
            if (!hasCronExpression) {
                await db.execute(`ALTER TABLE task ADD COLUMN cron_expression TEXT NOT NULL DEFAULT ''`)
            }
        },
    },
    {
        version: 5,
        up: async (db: DB) => {
            await db.execute(`DROP TABLE IF EXISTS users`)
        },
    },
]

export default {
    versions,
}
