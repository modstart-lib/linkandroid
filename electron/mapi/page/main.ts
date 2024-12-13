import {ipcMain} from "electron";
import {Page} from "../../page";

const open = async (name: string, option?: {
    singleton?: boolean,
}) => {
    return await Page.open(name, option)
}

ipcMain.handle('page:open', async (event, name: string, option?: {
    singleton?: boolean,
}) => {
    return open(name, option)
})

export const PageMain = {
    open
}
export default PageMain
