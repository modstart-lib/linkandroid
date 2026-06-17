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

export default {
    startScheduler,
    stopScheduler,
    isSchedulerRunning,
    getSchedulerStatus,
    getNextRunTime,
    resetTaskTrigger,
}
