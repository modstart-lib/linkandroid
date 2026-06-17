/**
 * Task Scheduler — 主进程定时任务调度器
 *
 * 每 30 秒检查一次数据库中的定时任务（run_mode = 'scheduled'），
 * 使用 croner 判断当前时间是否匹配 cron 表达式，匹配则执行任务。
 */

import {Cron} from 'croner'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {Log} from '../log/index'
import Apps from '../app/index'
import DBMain from '../db/main'
import {isPackaged} from '../../lib/env'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

interface TaskRow {
    id: number
    name: string
    description: string
    code: string
    language: string
    run_mode: string
    cron_expression: string
}

const CHECK_INTERVAL_MS = 30_000

// 记录每个定时任务最后触发的分钟标识 "YYYY-MM-DD HH:mm"
const lastTriggeredMinute = new Map<number, string>()

let intervalHandle: ReturnType<typeof setInterval> | null = null

/**
 * 获取当前分钟标识
 */
const currentMinuteKey = (date: Date = new Date()): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}`
}

/**
 * 构建 Python 执行环境
 */
const buildPythonEnv = () => {
    const basePath = isPackaged ? process.resourcesPath : process.env.APP_ROOT || path.resolve(_dirname, '../../..')
    const isWin = process.platform === 'win32'
    const pythonPath = isWin
        ? path.join(basePath, 'env/task/_aienv/Scripts/python.exe')
        : path.join(basePath, 'env/task/_aienv/bin/python')
    const libPath = path.join(basePath, 'env/task/lib')
    return {pythonPath, libPath, taskDir: path.join(basePath, 'env/task')}
}

/**
 * 执行单个定时任务
 */
const executeScheduledTask = async (task: TaskRow) => {
    const now = new Date().toISOString()
    let runId: number | string | null = null

    try {
        // 创建 pending 记录
        runId = await DBMain.insert(
            `INSERT INTO task_run (created_at, updated_at, task_id, device_id, status, log, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [now, now, task.id, 'scheduler', 'pending', '', null],
        )

        // 更新为 running
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, started_at = ? WHERE id = ?`, [
            now,
            'running',
            now,
            runId,
        ])

        const {pythonPath, libPath, taskDir} = buildPythonEnv()

        let logOutput = ''

        const controller = await Apps.spawnShell([pythonPath, '-c', task.code], {
            shell: false,
            cwd: taskDir,
            stdout: (data: string) => {
                logOutput += data
            },
            stderr: (data: string) => {
                logOutput += data
            },
            env: {
                LINKANDROID_TASK_ID: `${task.id}`,
                LINKANDROID_TASK_NAME: task.name,
                PYTHONPATH: libPath,
            },
        })

        const result = await controller.result()
        logOutput = result || logOutput

        const finishedAt = new Date().toISOString()
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
            finishedAt,
            'success',
            logOutput,
            finishedAt,
            runId,
        ])

        Log.info('TaskScheduler.executeSuccess', {taskId: task.id, taskName: task.name})
    } catch (e: any) {
        const errMsg = e?.message || String(e)
        const finishedAt = new Date().toISOString()
        if (runId) {
            await DBMain.update(
                `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                [finishedAt, 'failed', errMsg, finishedAt, runId],
            ).catch(() => {})
        }
        Log.error('TaskScheduler.executeFailed', {taskId: task.id, taskName: task.name, error: errMsg})
    } finally {
        lastTriggeredMinute.set(task.id, currentMinuteKey())
    }
}

/**
 * 执行一次调度检查
 */
const doSchedulerTick = async () => {
    try {
        const tasks: TaskRow[] = await DBMain.select(
            `SELECT id, name, description, code, language, run_mode, cron_expression
             FROM task
             WHERE run_mode = 'scheduled' AND cron_expression != ''`,
        )

        const now = new Date()
        const nowMinuteKey = currentMinuteKey(now)

        for (const task of tasks) {
            try {
                // 检查该分钟是否已触发过
                if (lastTriggeredMinute.get(task.id) === nowMinuteKey) {
                    continue
                }

                const job = new Cron(task.cron_expression)
                if (!job.match(now)) {
                    continue
                }

                // 异步执行，不阻塞后续任务检查
                executeScheduledTask(task).catch((e) => {
                    Log.error('TaskScheduler.executeError', {
                        taskId: task.id,
                        taskName: task.name,
                        error: e?.message || String(e),
                    })
                })
            } catch (e: any) {
                Log.error('TaskScheduler.checkError', {
                    taskId: task.id,
                    error: e?.message || String(e),
                })
            }
        }
    } catch (e: any) {
        Log.error('TaskScheduler.tickError', {error: e?.message || String(e)})
    }
}

/**
 * 根据任务 ID 手动执行任务（供 HTTP API / CLI 调用）
 */
export const runTaskById = async (
    taskId: number,
): Promise<{runId: number | string | null; success: boolean; log: string}> => {
    const task: TaskRow | undefined = await DBMain.first(
        `SELECT id, name, description, code, language, run_mode, cron_expression
         FROM task WHERE id = ?`,
        [taskId],
    )
    if (!task) {
        return {runId: null, success: false, log: 'TaskNotFound'}
    }
    let runId: number | string | null = null
    let logOutput = ''
    try {
        const now = new Date().toISOString()
        runId = await DBMain.insert(
            `INSERT INTO task_run (created_at, updated_at, task_id, device_id, status, log, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [now, now, task.id, 'cli', 'pending', '', null],
        )
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, started_at = ? WHERE id = ?`, [
            now,
            'running',
            now,
            runId,
        ])
        const {pythonPath, libPath, taskDir} = buildPythonEnv()
        const controller = await Apps.spawnShell([pythonPath, '-c', task.code], {
            shell: false,
            cwd: taskDir,
            stdout: (data: string) => {
                logOutput += data
            },
            stderr: (data: string) => {
                logOutput += data
            },
            env: {
                LINKANDROID_TASK_ID: `${task.id}`,
                LINKANDROID_TASK_NAME: task.name,
                PYTHONPATH: libPath,
            },
        })
        const result = await controller.result()
        logOutput = result || logOutput
        const finishedAt = new Date().toISOString()
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
            finishedAt,
            'success',
            logOutput,
            finishedAt,
            runId,
        ])
        Log.info('Task.runTaskById.success', {taskId, taskName: task.name})
        return {runId, success: true, log: logOutput}
    } catch (e: any) {
        const errMsg = e?.message || String(e)
        const finishedAt = new Date().toISOString()
        if (runId) {
            await DBMain.update(
                `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                [finishedAt, 'failed', errMsg, finishedAt, runId],
            ).catch(() => {})
        }
        Log.error('Task.runTaskById.failed', {taskId, error: errMsg})
        return {runId, success: false, log: errMsg}
    }
}

/**
 * 获取指定任务的下次执行时间
 */
export const getNextRunTime = (cronExpression: string): string | null => {
    if (!cronExpression) return null
    try {
        const job = new Cron(cronExpression)
        const next = job.nextRun()
        return next ? next.toISOString() : null
    } catch {
        return null
    }
}

/**
 * 获取所有定时任务的调度状态
 */
export const getSchedulerStatus = async (): Promise<
    Array<{
        id: number
        name: string
        cronExpression: string
        nextRun: string | null
        lastTriggeredAt: string | null
    }>
> => {
    const tasks: TaskRow[] = await DBMain.select(
        `SELECT id, name, cron_expression FROM task WHERE run_mode = 'scheduled' AND cron_expression != ''`,
    )
    return tasks.map((t) => {
        const lastKey = lastTriggeredMinute.get(t.id)
        const lastTriggeredAt = lastKey ? `${lastKey}:00Z` : null
        return {
            id: t.id,
            name: t.name,
            cronExpression: t.cron_expression,
            nextRun: getNextRunTime(t.cron_expression),
            lastTriggeredAt,
        }
    })
}

/**
 * 重置某任务的触发状态（用于测试/手动更新后）
 */
export const resetTaskTrigger = (taskId: number) => {
    lastTriggeredMinute.delete(taskId)
}

/**
 * 启动调度器
 */
export const start = () => {
    if (intervalHandle) return
    Log.info('TaskScheduler.start', {})
    // 启动后立即执行一次
    doSchedulerTick()
    intervalHandle = setInterval(doSchedulerTick, CHECK_INTERVAL_MS)
}

/**
 * 停止调度器
 */
export const stop = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle)
        intervalHandle = null
    }
    lastTriggeredMinute.clear()
    Log.info('TaskScheduler.stop', {})
}

/**
 * 调度器是否正在运行
 */
export const isRunning = (): boolean => {
    return intervalHandle !== null
}
