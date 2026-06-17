import {t} from '../../lang'
import {mapError} from '../../lib/error'
import {runTaskPythonCode} from './TaskRuntime'

export interface TaskRunTarget {
    id: number
    name: string
    description: string
    code: string
    language: string
}

const nowText = () => new Date().toISOString()

const createRunRecord = async (taskId: number, deviceId: string) => {
    const now = nowText()
    return await window.$mapi.db.insert(
        `INSERT INTO task_run (created_at, updated_at, task_id, device_id, status, log, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [now, now, taskId, deviceId, 'pending', '', null],
    )
}

const updateRunRecord = async (id: number | string, status: string, log: string, finishedAt: string | null = null) => {
    await window.$mapi.db.update(
        `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
        [nowText(), status, log, finishedAt, id],
    )
}

const runPythonCode = async (task: TaskRunTarget, deviceId: string, deviceIds: string[]) => {
    const controller = await runTaskPythonCode(task.code, deviceId, {
        deviceIds,
        env: {
            LINKANDROID_TASK_ID: `${task.id}`,
            LINKANDROID_TASK_NAME: task.name,
        },
    })
    return await controller.result()
}

export const runTaskOnDevices = async (task: TaskRunTarget, deviceIds: string[]) => {
    if (deviceIds.length === 0) {
        throw t('hint.selectDeviceFirst')
    }
    const runIds: Array<number | string> = []
    const runId = await createRunRecord(task.id, deviceIds.join(','))
    runIds.push(runId)
    await window.$mapi.db.update(`UPDATE task_run SET updated_at = ?, status = ?, started_at = ? WHERE id = ?`, [
        nowText(),
        'running',
        nowText(),
        runId,
    ])
    try {
        const log = await runPythonCode(task, deviceIds[0], deviceIds)
        await updateRunRecord(runId, 'success', log || t('task.noLog'), nowText())
    } catch (e) {
        await updateRunRecord(runId, 'failed', mapError(e), nowText())
    }
    return runIds
}
