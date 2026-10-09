import {createApp} from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import ArcoVue, {Message} from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'

import {i18n, t} from './lang'

import {Dialog} from './lib/dialog'
import './style.less'

import {reportErrorRender} from '../electron/mapi/log/beacon-render'
import {useSettingStore} from './store/modules/setting'
import {TaskManager} from './task'
import {initTestRegistry, registerNavigate} from './utils/test'

// ── Runtime diagnostics: log locally first, then report remotely ──────────
const logRendererInfo = (label: string, data: any = null) => {
    try {
        window.$mapi?.log?.info(`renderer.${label}`, data)
    } catch (e) {}
}
const logRendererError = (label: string, data: any = null) => {
    try {
        window.$mapi?.log?.error(`renderer.${label}`, data)
    } catch (e) {}
}

// Boot marker. If it never appears in the log, the bundle did not run at all
// (a resource / load failure); if it appears but "mounted" does not, the crash
// happened during mount.
logRendererInfo('boot', {
    href: location.href,
    ua: navigator.userAgent,
})

// Registered before mount on purpose: startup / mount errors are the most
// common cause of a white screen, and were previously missed because the
// handlers were only attached after `app.mount` resolved.
window.addEventListener('error', (ev) => {
    logRendererError('window.error', {
        message: ev.message,
        stack: ev.error?.stack,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
    })
    reportErrorRender(ev.message, ev.error?.stack, ev.filename, ev.lineno, ev.colno)
})

window.addEventListener('unhandledrejection', (ev) => {
    const err = ev.reason
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logRendererError('window.unhandledrejection', {message: msg, stack})
    reportErrorRender(msg, stack)
})

const settingStore = useSettingStore()

const app = createApp(App)

// Vue render / lifecycle errors: usually what turns a working page blank.
app.config.errorHandler = (err, instance, info) => {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logRendererError('vue.errorHandler', {message: msg, stack, info})
    reportErrorRender(msg, stack, undefined, undefined, undefined, '/renderer/vue')
}

// Router navigation errors (bad route / lazy chunk load failure).
router.onError((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logRendererError('router.error', {message: msg, stack})
    reportErrorRender(msg, stack, undefined, undefined, undefined, '/renderer/router')
})

app.use(ArcoVue)
app.use(ArcoVueIcon)
app.use(i18n)
app.use(store)
app.use(router)
Message._context = app._context
app.config.globalProperties.$mapi = window.$mapi
app.config.globalProperties.$dialog = Dialog
app.config.globalProperties.$t = t as any
TaskManager.init()

initTestRegistry()
registerNavigate(async (path) => {
    await router.push(path)
})

app.mount('#app').$nextTick(() => {
    postMessage({payload: 'removeLoading'}, '*')
    logRendererInfo('mounted', {href: location.href})
})
