import {ipcMain} from "electron";
import {Page} from "../../page";

const open = async (name: string, option: any) => {
    return await Page.open(name, option)
}

ipcMain.handle('page:open', async (event, name: string, option: any) => {
    return open(name, option)
})

export default {
    open
}
