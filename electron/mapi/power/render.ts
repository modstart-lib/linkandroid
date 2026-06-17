import {ipcRenderer} from 'electron'

const start = async (reason: 'prevent-app-suspension' | 'prevent-display-sleep' = 'prevent-display-sleep') => {
    return ipcRenderer.invoke('powerSaveBlock:start', reason)
}

const stop = async () => {
    return ipcRenderer.invoke('powerSaveBlock:stop')
}

const isStarted = async () => {
    return ipcRenderer.invoke('powerSaveBlock:isStarted')
}

export default {start, stop, isStarted}
