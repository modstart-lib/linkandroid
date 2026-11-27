/**
 * Task Scheduler — 主进程 IPC 入口
 *
 * 提供调度器生命周期控制和状态查询的 IPC 处理程序。
 * 同时导出 TaskScheduler 供 MAPI.init() 调用启动。
 */

import {ipcMain} from 'electron'
import * as scheduler from './scheduler'

export const TaskScheduler = scheduler

// ── 调度器生命周期 ──

ipcMain.handle('task:startScheduler', async () => {
    scheduler.start()
})

ipcMain.handle('task:stopScheduler', async () => {
    scheduler.stop()
})

ipcMain.handle('task:isSchedulerRunning', async (): Promise<boolean> => {
    return scheduler.isRunning()
})

// ── 调度状态查询 ──

ipcMain.handle('task:getSchedulerStatus', async () => {
    return scheduler.getSchedulerStatus()
})

ipcMain.handle('task:getNextRunTime', async (event, cronExpression: string): Promise<string | null> => {
    return scheduler.getNextRunTime(cronExpression)
})

// ── 运行闸门（手动运行与定时任务共用）──

ipcMain.handle('task:acquireRun', async (event, taskId: number, deviceIds: string[] = [], token: string = '') => {
    return await scheduler.acquireRun(taskId, deviceIds, token)
})

ipcMain.handle('task:waitRunGranted', async (event, runId: number | string) => {
    return await scheduler.waitRunGranted(runId)
})

ipcMain.handle('task:cancelQueuedRun', async (event, runId: number | string) => {
    return await scheduler.cancelQueuedRun(runId)
})

ipcMain.handle('task:releaseRun', async (event, taskId: number, token: string) => {
    scheduler.releaseRun(taskId, token)
})

// ── 测试辅助 ──

ipcMain.handle('task:resetTaskTrigger', async (event, taskId: number) => {
    scheduler.resetTaskTrigger(taskId)
})

export default TaskScheduler
