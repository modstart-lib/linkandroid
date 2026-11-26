/**
 * Task project storage — renderer IPC wrapper.
 */
import {ipcRenderer} from 'electron'

export type ProjectFileItem = {
    path: string
    size: number
    isDir: boolean
    updatedAt: string
}

export const save = async (data: Record<string, any>): Promise<any> => {
    return ipcRenderer.invoke('project:save', data)
}

export const remove = async (id: number): Promise<void> => {
    return ipcRenderer.invoke('project:remove', id)
}

export const copy = async (id: number): Promise<any> => {
    return ipcRenderer.invoke('project:copy', id)
}

export const pathInfo = async (
    id: number,
): Promise<{id: number; uuid?: string; dir: string; entry: string; exists: boolean}> => {
    return ipcRenderer.invoke('project:path', id)
}

export const listFiles = async (id: number): Promise<ProjectFileItem[]> => {
    return ipcRenderer.invoke('project:listFiles', id)
}

export const readFile = async (id: number, relPath: string): Promise<string> => {
    return ipcRenderer.invoke('project:readFile', id, relPath)
}

export const writeFile = async (id: number, relPath: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('project:writeFile', id, relPath, content)
}

export const deleteFile = async (id: number, relPath: string): Promise<void> => {
    return ipcRenderer.invoke('project:deleteFile', id, relPath)
}

export const renameFile = async (id: number, fromPath: string, toPath: string): Promise<void> => {
    return ipcRenderer.invoke('project:renameFile', id, fromPath, toPath)
}

export const openDir = async (id: number): Promise<string> => {
    return ipcRenderer.invoke('project:openDir', id)
}



export const manifest = async (id: number): Promise<any> => {
    return ipcRenderer.invoke('project:manifest', id)
}

export default {
    save,
    remove,
    copy,
    pathInfo,
    listFiles,
    readFile,
    writeFile,
    deleteFile,
    renameFile,
    openDir,
    
    manifest,
}
