/**
 * Test-only actions for the task editor dialog.
 *
 * Kept out of TaskEditorDialog.vue so the dialog stays under the 1000-line
 * limit; nothing here runs in production.
 */
import {nextTick, onMounted, onUnmounted, type Ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'
import {firstEnabledModel} from '../../support/agent/agentModel'
import type {useTaskFiles} from './useTaskFiles'
import type {RunDeviceConfig} from './TaskRunDeviceSelectDialog.vue'

type EditorForm = {
    id: number
    uuid: string
    name: string
    description: string
    code: string
    language: string
    requirement: string
}

type Context = {
    formData: Ref<EditorForm>
    files: ReturnType<typeof useTaskFiles>
    chatPanel: Ref<any>
    devicePreviewPanel: Ref<any>
    runDeviceConfig: Ref<RunDeviceConfig>
    rightTab: Ref<'preview' | 'chat' | 'docs'>
    fillForm: (data: any) => void
    doSave: () => Promise<void>
    doRun: () => Promise<void>
    doSelectFile: (path: string) => Promise<void>
    doCreateFile: (path: string) => Promise<void>
    doRenameFile: (from: string, to: string) => Promise<void>
    doShowDeviceSelect: () => void
    close: (force?: boolean) => void
}

export const useTaskEditorTestActions = (ctx: Context) => {
    

    const testPreviewDevice = async () => {
        ctx.rightTab.value = 'preview'
        await nextTick()
        await ctx.devicePreviewPanel.value?.doPreview()
    }

    const testSelectFirstLocator = () => {
        ctx.rightTab.value = 'preview'
        return ctx.devicePreviewPanel.value?.testSelectFirstLocator() || ''
    }

    const testGetSelectedLocator = () => {
        return ctx.devicePreviewPanel.value?.getSelectedLocator() || ''
    }

    const testGetCode = () => {
        return ctx.files.entryCode.value
    }

    const testGetRunConfig = () => {
        return {
            runMode: ctx.runDeviceConfig.value.runMode,
            cronExpression: ctx.runDeviceConfig.value.cronExpression,
            runOnAllDevices: ctx.runDeviceConfig.value.runOnAllDevices,
            deviceIds: [...ctx.runDeviceConfig.value.deviceIds],
            autoRepair: ctx.runDeviceConfig.value.autoRepair,
        }
    }

    onMounted(() => {
        testActionSet('task.editor.fill', (data: any) => ctx.fillForm(data))
        testActionSet('task.editor.save', () => ctx.doSave())
        testActionSet('task.editor.run', () => ctx.doRun())
        
        testActionSet('task.editor.previewDevice', () => testPreviewDevice())
        testActionSet('task.editor.selectFirstLocator', () => testSelectFirstLocator())
        testActionSet('task.editor.getSelectedLocator', () => testGetSelectedLocator())
        testActionSet('task.editor.getCode', () => testGetCode())
        testActionSet('task.editor.getActiveCode', () => ctx.files.activeContent.value)
        testActionSet('task.editor.getRunConfig', () => testGetRunConfig())
        testActionSet('task.editor.files', () => ({
            entry: ctx.files.entry.value,
            active: ctx.files.activePath.value,
            files: ctx.files.visibleFiles.value.map((file) => file.path),
            dirty: ctx.files.dirtyPaths.value,
        }))
        testActionSet('task.editor.fileOpen', async (path: string) => ctx.doSelectFile(path))
        testActionSet('task.editor.fileCreate', async (path: string) => ctx.doCreateFile(path))
        testActionSet('task.editor.fileRename', async (arg: {from: string; to: string}) =>
            ctx.doRenameFile(arg.from, arg.to),
        )
        testActionSet('task.editor.fileDelete', async (path: string) => {
            if (ctx.formData.value.id > 0) await ctx.files.removeFile(ctx.formData.value.id, path)
        })
        testActionSet('task.editor.fileWrite', async (arg: {path: string; content: string}) => {
            await ctx.doSelectFile(arg.path)
            ctx.files.setActiveContent(arg.content)
            if (arg.path === ctx.files.entry.value) ctx.formData.value.code = arg.content
        })
        testActionSet('task.editor.close', () => ctx.close(true))
        testActionSet('task.editor.showDeviceSelect', () => ctx.doShowDeviceSelect())
        
    })

    onUnmounted(() => {
        testActionUnset('task.editor.fill')
        testActionUnset('task.editor.save')
        testActionUnset('task.editor.run')
        
        testActionUnset('task.editor.previewDevice')
        testActionUnset('task.editor.selectFirstLocator')
        testActionUnset('task.editor.getSelectedLocator')
        testActionUnset('task.editor.getCode')
        testActionUnset('task.editor.getActiveCode')
        testActionUnset('task.editor.getRunConfig')
        testActionUnset('task.editor.files')
        testActionUnset('task.editor.fileOpen')
        testActionUnset('task.editor.fileCreate')
        testActionUnset('task.editor.fileRename')
        testActionUnset('task.editor.fileDelete')
        testActionUnset('task.editor.fileWrite')
        testActionUnset('task.editor.close')
        testActionUnset('task.editor.showDeviceSelect')
        
    })

    return {
        
        testPreviewDevice,
        testSelectFirstLocator,
        testGetSelectedLocator,
        testGetCode,
    }
}
