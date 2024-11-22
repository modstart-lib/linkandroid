import {BrowserWindow} from "electron";

type HookType = never
    | 'Show'
    | 'Hide'

export const executeHooks = async (win: BrowserWindow, hook: HookType, data?: any) => {
    const evalJs = `
    if(window.__page && window.__page.hooks && typeof window.__page.hooks.on${hook} === 'function' ) {
        try {
            window.__page.hooks.on${hook}(${JSON.stringify(data)});
        } catch(e) {
            console.log('executeHooks.on${hook}.error', e);
        }
    }`;
    return win.webContents?.executeJavaScript(evalJs);
}
