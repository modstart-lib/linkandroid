import {BrowserWindow} from "electron";
import {AppsMain} from "./main";
import {icons} from "./icons";

let win = null;
let winCloseTimer = null;

export const makeToast = (
    msg: string,
    options?: {
        duration?: number;
        status?: "success" | "error" | "info";
    }
) => {
    if (win) {
        win.close();
        clearTimeout(winCloseTimer);
        win = null;
        winCloseTimer = null;
    }

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
    // console.log('options', options)

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
            height: 100vh;
            margin: 0;
            padding: 0;
            background: rgba(0, 0, 0, 0.4);
            color: #FFFFFF;
            font-family: "PingFang SC", "Helvetica Neue", Helvetica, STHeiTi, "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
        }
        .message-view {
            height: 100vh;
            display:flex;
            text-align:center;
            padding:0 10px;
        }
        .message-view div{
            margin: auto;
            font-size: 16px;
            display: inline-block;
            line-height: 30px;
            white-space: nowrap;
        }
        .message-view div .icon{
            width: 30px;
            height: 30px;
            display:inline-block;
            margin-right: 5px;
            vertical-align: top;
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
    winCloseTimer = setTimeout(() => {
        win.close();
        clearTimeout(winCloseTimer);
        win = null;
        winCloseTimer = null;
    }, options.duration);
};
