import {AppRuntime} from "../env";

const init = () => {

}

const send = (type: string, data: any = {}) => {
    AppRuntime.mainWindow?.webContents.send('MAIN_PROCESS_MESSAGE', {
        type, data
    })
}

export default {
    init,
    send,
    Event: {
        send
    }
}
