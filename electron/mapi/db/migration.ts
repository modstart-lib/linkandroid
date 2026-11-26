import {randomUUID} from 'node:crypto'

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
    {
        version: 6,
        up: async (db: DB) => {
            // 持久化「运行设置」: 目标设备列表 + 是否所有设备
            const columns = await db.select('PRAGMA table_info(task)')
            if (!columns.some((c: any) => c.name === 'device_ids')) {
                await db.execute(`ALTER TABLE task ADD COLUMN device_ids TEXT DEFAULT ''`)
            }
            if (!columns.some((c: any) => c.name === 'run_on_all_devices')) {
                await db.execute(`ALTER TABLE task ADD COLUMN run_on_all_devices INTEGER NOT NULL DEFAULT 0`)
            }
        },
    },
    {
        version: 7,
        up: async (db: DB) => {
            // 任务：原始需求、项目化 uuid 与云端关联（目录与文件由 electron/mapi/project 维护）、
            // 运行失败自动修复开关
            const taskColumns = await db.select('PRAGMA table_info(task)')
            const hasTask = (name: string) => taskColumns.some((c: any) => c.name === name)
            const taskAddColumns: Array<[string, string]> = [
                ['requirement', `TEXT NOT NULL DEFAULT ''`],
                ['uuid', `TEXT DEFAULT ''`],
                ['cloud_task_id', 'INTEGER NOT NULL DEFAULT 0'],
                ['cloud_visibility', `TEXT NOT NULL DEFAULT 'private'`],
                ['cloud_version', 'INTEGER NOT NULL DEFAULT 0'],
                ['cloud_updated_at', `TEXT DEFAULT ''`],
                ['last_sync_at', `TEXT DEFAULT ''`],
                ['auto_repair', 'INTEGER NOT NULL DEFAULT 1'],
            ]
            for (const [name, type] of taskAddColumns) {
                if (!hasTask(name)) {
                    await db.execute(`ALTER TABLE task ADD COLUMN ${name} ${type}`)
                }
            }
            // 逐行回填，避免空值在唯一索引上冲突
            const rows = await db.select('SELECT id, uuid FROM task')
            for (const row of rows) {
                if (row.uuid) continue
                await db.execute('UPDATE task SET uuid = ? WHERE id = ?', [randomUUID(), row.id])
            }
            // 只对已有 uuid 的行建唯一索引，兼容测试/脚本直接插入的历史写法
            await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_task_uuid ON task(uuid) WHERE uuid != ''`)

            // 通用 Agent 会话：AI 对话、任务对话、自动修复共用；会话上冗余摘要列，
            // 助手消息只存本轮 OpenCode 消息 id，思考与工具步骤打开会话时再按 id 懒加载
            await db.execute(`CREATE TABLE IF NOT EXISTS agent_chat_session (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT '',
                business TEXT NOT NULL DEFAULT 'ai-chat',
                business_id TEXT NOT NULL DEFAULT '',
                ref_id TEXT NOT NULL DEFAULT '',
                device_id TEXT NOT NULL DEFAULT '',
                provider_id TEXT NOT NULL DEFAULT '',
                model_id TEXT NOT NULL DEFAULT '',
                opencode_session_id TEXT NOT NULL DEFAULT '',
                last_message TEXT NOT NULL DEFAULT '',
                last_role TEXT NOT NULL DEFAULT '',
                message_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`)
            await db.execute(`CREATE TABLE IF NOT EXISTS agent_chat_message (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                parts TEXT NOT NULL DEFAULT '',
                opencode_message_ids TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES agent_chat_session(id) ON DELETE CASCADE
            )`)
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_agent_chat_session_business ON agent_chat_session(business, business_id, updated_at)`,
            )
        },
    },
]

export default {
    versions,
}
