/**
 * 任务导入导出：文件对话框、批量导入编排与结果汇总。
 *
 * 导入前先预读每个 zip 的任务名，同名任务在写入磁盘前一次性确认；
 * 实际落盘与数据库写入由主进程 project 模块负责。
 */
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'

export type TaskTransferFailure = {file: string; error: string}

export type TaskTransferResult = {
    imported: string[]
    failed: TaskTransferFailure[]
    skipped: number
}

type ImportPreview = {path: string; name: string; exists: boolean; error?: string}

type ImportTarget = {path: string; overwrite: boolean}

const baseName = (file: string) =>
    String(file || '')
        .replace(/\\/g, '/')
        .split('/')
        .pop() || String(file || '')

const zipFilters = () => [{name: t('task.zipFilter'), extensions: ['zip']}]

const uniquePaths = (paths: string[]) => Array.from(new Set((paths || []).filter((item) => !!item)))

export const useTaskTransfer = () => {
    const showImportResult = (result: TaskTransferResult) => {
        const {imported, failed} = result
        if (failed.length === 0) {
            if (imported.length > 0) {
                Dialog.tipSuccess(t('task.importSuccess', {count: imported.length}))
            }
            return
        }
        const list = failed.map((item) => `${item.file}（${item.error}）`).join('；')
        if (imported.length > 0) {
            Dialog.alertError(
                t('task.importPartial', {success: imported.length, failed: failed.length, list}),
                t('task.importTitle'),
            )
        } else {
            Dialog.alertError(t('task.importFailed', {list}), t('task.importTitle'))
        }
    }

    const applyImport = async (
        targets: ImportTarget[],
        broken: TaskTransferFailure[] = [],
    ): Promise<TaskTransferResult> => {
        const result: TaskTransferResult = {imported: [], failed: [...broken], skipped: 0}
        if (targets.length === 0) return result
        Dialog.loadingOn(t('task.importing'))
        try {
            for (const target of targets) {
                try {
                    const imported = await window.$mapi.project.importFromFile(target.path, target.overwrite)
                    if (imported.ok) {
                        result.imported.push(imported.name)
                    } else {
                        result.skipped++
                    }
                } catch (e) {
                    result.failed.push({file: baseName(target.path), error: mapError(e)})
                }
            }
        } finally {
            Dialog.loadingOff()
        }
        return result
    }

    const importPaths = async (paths: string[], overwrite: boolean = false): Promise<TaskTransferResult> => {
        return await applyImport(uniquePaths(paths).map((path) => ({path, overwrite})))
    }

    /** Import already chosen zip paths; a same-name task is confirmed once before overwriting. */
    const doImportPaths = async (paths: string[]): Promise<TaskTransferResult | null> => {
        const files = uniquePaths(paths)
        if (files.length === 0) return null
        let preview: ImportPreview[] = []
        Dialog.loadingOn(t('task.importing'))
        try {
            preview = await window.$mapi.project.previewImport(files)
        } catch (e) {
            Dialog.tipError(mapError(e))
            return null
        } finally {
            Dialog.loadingOff()
        }
        const broken: TaskTransferFailure[] = preview
            .filter((item) => !!item.error)
            .map((item) => ({file: baseName(item.path), error: mapError(item.error)}))
        const valid = preview.filter((item) => !item.error)
        const conflicts = valid.filter((item) => item.exists)
        const fresh = valid.filter((item) => !item.exists)
        const targets: ImportTarget[] = [
            ...fresh.map((item) => ({path: item.path, overwrite: false})),
            ...conflicts.map((item) => ({path: item.path, overwrite: true})),
        ]
        if (conflicts.length === 0) {
            const result = await applyImport(targets, broken)
            showImportResult(result)
            return result
        }
        const names =
            conflicts
                .slice(0, 3)
                .map((item) => item.name)
                .join('、') + (conflicts.length > 3 ? ` 等 ${conflicts.length} 个` : '')
        const content =
            conflicts.length === 1
                ? t('task.importOverwriteConfirmOne', {name: conflicts[0].name})
                : t('task.importOverwriteConfirmMany', {count: conflicts.length, names})
        // Dialog.confirm only resolves on OK: cancelling leaves every existing task untouched.
        return await new Promise((resolve) => {
            Dialog.confirm(content, t('task.importOverwriteTitle'), t('task.importOverwriteOk')).then(async () => {
                const result = await applyImport(targets, broken)
                showImportResult(result)
                resolve(result)
            })
        })
    }

    const doImport = async (): Promise<TaskTransferResult | null> => {
        const options: any = {
            title: t('task.import'),
            properties: ['multiSelections'],
            filters: zipFilters(),
        }
        const picked: string | string[] | null = await window.$mapi.file.openFile(options)
        if (!picked) return null
        return await doImportPaths(Array.isArray(picked) ? picked : [picked])
    }

    const exportTo = async (id: number, targetPath: string) => {
        return await window.$mapi.project.exportToFile(id, targetPath)
    }

    const doExport = async (record: {id: number; name: string}) => {
        const target = await window.$mapi.file.openSave({
            title: t('task.export'),
            defaultPath: `${record.name || 'task'}.zip`,
            filters: zipFilters(),
        })
        if (!target) return null
        Dialog.loadingOn(t('task.exporting'))
        try {
            const result = await exportTo(record.id, target)
            Dialog.tipSuccess(t('task.exportSuccess', {path: result.path}))
            return result
        } catch (e) {
            Dialog.tipError(mapError(e))
            return null
        } finally {
            Dialog.loadingOff()
        }
    }

    const exportAllTo = async (dir: string) => {
        return await window.$mapi.project.exportAllTo(dir)
    }

    const doExportAll = async () => {
        const dir = await window.$mapi.file.openDirectory({title: t('task.exportAll')})
        if (!dir) return null
        Dialog.loadingOn(t('task.exporting'))
        try {
            const result = await exportAllTo(dir)
            if (result.failed.length === 0) {
                Dialog.tipSuccess(t('task.exportAllSuccess', {count: result.exported, path: dir}))
            } else {
                const list = result.failed.map((item) => `${item.name}（${mapError(item.error)}）`).join('；')
                Dialog.alertError(
                    t('task.exportPartial', {count: result.exported, failed: result.failed.length, list}),
                    t('task.exportAll'),
                )
            }
            return result
        } catch (e) {
            Dialog.tipError(mapError(e))
            return null
        } finally {
            Dialog.loadingOff()
        }
    }

    return {doImport, doImportPaths, importPaths, doExport, exportTo, doExportAll, exportAllTo}
}
