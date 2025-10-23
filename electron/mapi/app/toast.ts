import { BrowserWindow } from "electron";
import { icons } from "./icons";
import { AppsMain } from "./main";

let win = null;
let winCloseTimer = null;
let winShowTime = null;
const toastMsgQueue: { msg: string, options: any }[] = [];

export const makeToast = async (
    msg: string,
    options?: {
        duration?: number;
        status?: "success" | "error" | "info";
    }
) => {
    if (win) {
        if (winShowTime && Date.now() - winShowTime < 1000) {
            // make previous toast last at least 1 second
            if (toastMsgQueue.length > 0) {
                toastMsgQueue.forEach(item => {
                    item.options = Object.assign({}, item.options, {duration: 1000});
                })
            }
            toastMsgQueue.push({msg, options});
            await new Promise(resolve => setTimeout(resolve, 1000 - (Date.now() - winShowTime)));
            if (win) {
                win.close();
            }
            return;
        }
        win.close();
    }
    winShowTime = Date.now();

    options = Object.assign(
        {
            status: "info",
            duration: 0,
        },
        options
    );

    if (options.duration === 0) {
        options.duration = Math.max(msg.length * 400, 3000);
    }
    // console.log('toast', msg, options)

    const display = AppsMain.getCurrentScreenDisplay();
    // console.log('xxxx', primaryDisplay);
    const width = display.workArea.width;
    const height = 60;
    const icon = icons[options.status] || icons.success;

    win = new BrowserWindow({
        height,
        width,
        x: 0,
        y: 0,
        modal: false,
        frame: false,
        alwaysOnTop: true,
        // opacity: 0.9,
        center: false,
        transparent: true,
        hasShadow: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
    });
        const htmlContent = `
    <!DOCTYPE html>
    <html>
        <head>
            <style>
                html,body{
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        background: transparent;
                        color: #FFFFFF;
                        font-family: "PingFang SC", "Helvetica Neue", Helvetica, STHeiTi, "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
                }
                .message-view {
                        height: 100%;
                        display:flex;
                        text-align:center;
                        padding:10px;
                        box-sizing: border-box;
                }
                .message-view div{
                        margin: auto;
                        font-size: 16px;
                        display: inline-flex;
                        align-items: center;
                        line-height: 20px;
                        white-space: nowrap;
                        background: rgba(0, 0, 0, 0.85);
                        border-radius: 15px;
                        padding: 8px 14px;
                        box-shadow: 0 6px 18px rgba(0,0,0,0.3);
                }
                .message-view div .icon{
                        width: 30px;
                        height: 30px;
                        display:inline-block;
                        margin-right: 8px;
                        vertical-align: middle;
                }
                ::-webkit-scrollbar {
                    width: 0;
                }
            </style>
        </head>
        <body>
            <div class="message-view" onclick="window.close()">
                <div id="message">${icon}${msg}</div>
            </div>
        </body>
    </html>
`;

    const encodedHTML = encodeURIComponent(htmlContent);
    win.loadURL(`data:text/html;charset=UTF-8,${encodedHTML}`);
    win.on("ready-to-show", async () => {
        if (!win) return;
        const width = Math.ceil(
            await win.webContents.executeJavaScript(`(()=>{
            const message = document.getElementById('message');
            const width = message.scrollWidth;
            return width;
        })()`)
        );
        win.setSize(width + 20, height);
        const x = display.workArea.x + display.workArea.width / 2 - (width + 20) / 2;
        const y = display.workArea.y + (display.workArea.height * 1) / 4;
        win.setPosition(Math.floor(x), Math.floor(y));
        win.show();
        // win.webContents.openDevTools({
        //     mode: 'detach'
        // })
    });
    win.on("closed", () => {
        win = null;
        if (winCloseTimer) {
            clearTimeout(winCloseTimer);
        }
        setTimeout(() => {
            if (toastMsgQueue.length > 0) {
                const item = toastMsgQueue.shift();
                makeToast(item.msg, item.options);
            }
        }, 0);
    })
    winCloseTimer = setTimeout(() => {
        winCloseTimer = null;
        if (!win) return;
        win.close();
    }, options.duration);
};
