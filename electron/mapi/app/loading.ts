import {BrowserWindow} from "electron";
import {AppsMain} from "./main";
import {icons} from "./icons";

export const makeLoading = (msg: string, options?: {
    timeout?: number,
    percentAuto?: boolean,
    percentTotalSeconds?: number,
}): {
    close: () => void,
    percent: (value: number) => void
} => {

    options = Object.assign({
        percentAuto: false,
        percentTotalSeconds: 30,
        timeout: 0
    }, options)

    if (options.timeout === 0) {
        options.timeout = 60 * 10 * 1000
    }
    // console.log('options', options)

    const display = AppsMain.getCurrentScreenDisplay()
    // console.log('xxxx', primaryDisplay);
    const width = display.workArea.width
    const height = 60
    const icon = icons.loading

    const win = new BrowserWindow({
        height,
        width,
        x: 0,
        y: 0,
        modal: false,
        frame: false,
        alwaysOnTop: true,
        center: false,
        transparent: true,
        hasShadow: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
    })
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
        }
        .message-view {
            height: 100vh;
            display:flex;
            text-align:center;
            padding:0 10px;
            position:relative;
        }
        .message-view #message{
            margin: auto;
            font-size: 16px;
            display: inline-block;
            line-height: 30px;
            white-space: nowrap;
        }
        .message-view #message .icon{
            width: 30px;
            height: 30px;
            display:inline-block;
            margin-right: 5px;
            vertical-align: top;
        }
        .message-view #percent{
            position: absolute;
            bottom: 5px;
            left: 5px;
            right: 5px;
            height: 5px;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.4);
            overflow: hidden;
            display:none;
        }
        .message-view #percent .value{
            border-radius: 5px;
            height: 100%;
            width: 0%;
            background: #FFFFFF;
        }
        ::-webkit-scrollbar {
          width: 0;
        }
      </style>
    </head>
    <body>
      <div class="message-view">
        <div id="message">${icon}${msg}</div>
        <div id="percent">
            <div class="value"></div>
        </div>
      </div>
    </body>
  </html>
`;

    const encodedHTML = encodeURIComponent(htmlContent);
    let percentAutoTimer = null
    win.loadURL(`data:text/html;charset=UTF-8,${encodedHTML}`);
    win.on('ready-to-show', async () => {
        const width = Math.ceil(await win.webContents.executeJavaScript(`(()=>{
            const message = document.getElementById('message');
            const width = message.scrollWidth;
            return width;
        })()`))
        win.setSize(width + 20, height)
        const x = display.workArea.x + (display.workArea.width / 2) - ((width + 20) / 2)
        const y = display.workArea.y + (display.workArea.height * 1 / 4)
        win.setPosition(Math.floor(x), Math.floor(y))
        win.show()
        if (options.percentAuto) {
            let percent = 0
            percentAutoTimer = setInterval(() => {
                percent += 0.01
                if (percent >= 1) {
                    clearInterval(percentAutoTimer)
                    return
                }
                controller.percent(percent)
            }, options.percentTotalSeconds * 1000 / 100)
        }
        // win.webContents.openDevTools({
        //     mode: 'detach'
        // })
    })
    const winCloseTimer = setTimeout(() => {
        win.close()
        clearTimeout(winCloseTimer)
    }, options.timeout)
    const controller = {
        close: () => {
            win.close()
            clearTimeout(winCloseTimer)
            if (percentAutoTimer) {
                clearInterval(percentAutoTimer)
            }
        },
        percent: (value: number) => {
            const percent = 100 * value
            win.webContents.executeJavaScript(`(()=>{
                const percent = document.querySelector('#percent');
                const percentValue = document.querySelector('#percent .value');
                percent.style.display = 'block';
                percentValue.style.width = '${percent}%';
            })()`)
        }
    }
    return controller
}
