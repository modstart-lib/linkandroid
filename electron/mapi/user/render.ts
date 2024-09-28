import page from "../page/render";
import electron from "electron";

const open = async (option: any) => {
    await page.open('user', option)
}

const get = async (): Promise<{
    apiToken: string,
    user: object,
    data: any
}> => {
    return electron.ipcRenderer.invoke('user:get')
}

const save = async (data: {
    apiToken: string,
    user: object,
    data: any
}) => {
    return electron.ipcRenderer.invoke('user:save', data)
}


export default {
    open,
    save,
    get
}
