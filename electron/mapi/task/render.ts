/**
 * Task Scheduler — 渲染进程 IPC 包装
 */

import {ipcRenderer} from 'electron'

export const startScheduler = async (): Promise<void> => {
    return ipcRenderer.invoke('task:startScheduler')
}

export const stopScheduler = async (): Promise<void> => {
    return ipcRenderer.invoke('task:stopScheduler')
}

export const isSchedulerRunning = async (): Promise<boolean> => {
    return ipcRenderer.invoke('task:isSchedulerRunning')
}

export const getSchedulerStatus = async (): Promise<
    Array<{
        id: number
        name: string
        cronExpression: string
        nextRun: string | null
        lastTriggeredAt: string | null
    }>
> => {
    return ipcRenderer.invoke('task:getSchedulerStatus')
}

export const getNextRunTime = async (cronExpression: string): Promise<string | null> => {
    return ipcRenderer.invoke('task:getNextRunTime', cronExpression)
}

export const resetTaskTrigger = async (taskId: number): Promise<void> => {
    return ipcRenderer.invoke('task:resetTaskTrigger', taskId)
}

/** 手动运行前的占位；queued 表示任务在跑，已排队 */
export const acquireRun = async (
    taskId: number,
    deviceIds: string[] = [],
    token: string = '',
): Promise<{status: 'granted' | 'queued'; runId?: number | string; position?: number}> => {
    return ipcRenderer.invoke('task:acquireRun', taskId, deviceIds, token)
}

/** 等排到自己；取消排队时返回 cancelled */
export const waitRunGranted = async (
    runId: number | string,
): Promise<{status: 'granted' | 'cancelled'; runId?: number | string}> => {
    return ipcRenderer.invoke('task:waitRunGranted', runId)
}

export const cancelQueuedRun = async (runId: number | string): Promise<boolean> => {
    return ipcRenderer.invoke('task:cancelQueuedRun', runId)
}

export const releaseRun = async (taskId: number, token: string): Promise<void> => {
    return ipcRenderer.invoke('task:releaseRun', taskId, token)
}

export default {
    startScheduler,
    stopScheduler,
    isSchedulerRunning,
    getSchedulerStatus,
    getNextRunTime,
    resetTaskTrigger,
    acquireRun,
    waitRunGranted,
    cancelQueuedRun,
    releaseRun,
}
