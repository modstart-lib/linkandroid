import {ipcRenderer} from 'electron'

const record = async (input: any) => ipcRenderer.invoke('history:record', input)
const list = async (uuid: string) => ipcRenderer.invoke('history:list', uuid)
const read = async (uuid: string, seq: number) => ipcRenderer.invoke('history:read', uuid, seq)
const markRead = async (uuid: string, seq?: number) => ipcRenderer.invoke('history:markRead', uuid, seq)
const summaries = async () => ipcRenderer.invoke('history:summaries')
const remove = async (uuid: string) => ipcRenderer.invoke('history:remove', uuid)
const tidy = async (uuid: string) => ipcRenderer.invoke('history:tidy', uuid)

export default {
    record,
    list,
    read,
    markRead,
    summaries,
    remove,
    tidy,
}
