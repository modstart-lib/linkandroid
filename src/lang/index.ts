import {createI18n} from 'vue-i18n'
import type {Messages, LocaleItem} from './types'

let localeInit = false
export const defaultLocale = 'zh-CN'

// 自动发现所有语言模块：import.meta.glob 匹配 lang/en-US.ts 和 lang/zh-CN.ts
// 分散在各模块中的语言定义都会被自动合并到主语言包中。
const enUSModules = import.meta.glob('/src/**/lang/en-US.ts', {eager: true, import: 'default'})
const zhCNModules = import.meta.glob('/src/**/lang/zh-CN.ts', {eager: true, import: 'default'})

const mergeModules = (record: Record<string, unknown>): Messages =>
    Object.assign({}, ...Object.values(record)) as Messages

const enUS = mergeModules(enUSModules)
const zhCN = mergeModules(zhCNModules)

export const messageList: LocaleItem[] = [
    {name: 'en-US', label: 'English', messages: enUS},
    {name: 'zh-CN', label: '简体中文', messages: zhCN},
]

const buildMessages = (): Record<string, Messages> => {
    const messages: Record<string, Messages> = {}
    for (const m of messageList) {
        messages[m.name] = m.messages
    }
    return messages
}

const messages = buildMessages()

const normalizeLocale = (lang: string) => {
    return messageList.some((m) => m.name === lang) ? lang : defaultLocale
}

export const i18n = createI18n({
    locale: defaultLocale,
    legacy: false,
    globalInjection: true,
    messages,
})

if (window.$mapi) {
    window.$mapi.config.get('lang', defaultLocale).then((lang: string) => {
        lang = normalizeLocale(lang)
        i18n.global.locale.value = lang as any
        localeInit = true
        fireLocaleChange(lang)
    })
}

export type {Messages, LocaleItem}

export const listLocales = () => {
    const list: LocaleItem[] = messageList
    list.forEach((item) => {
        item.active = i18n.global.locale.value === item.name
    })
    return list
}

export const getLocale = async () => {
    return new Promise<string>((resolve) => {
        if (localeInit) {
            resolve(i18n.global.locale.value as string)
        } else {
            setTimeout(() => {
                resolve(getLocale())
            }, 100)
        }
    })
}

let localeChangeListener: Array<(locale: string) => void> = []

export const onLocaleChange = (callback: (lang: string) => void) => {
    localeChangeListener.push(callback)
}

const fireLocaleChange = (lang: string) => {
    localeChangeListener.forEach((callback) => {
        callback(lang)
    })
}

export const changeLocale = (lang: string) => {
    lang = normalizeLocale(lang)
    i18n.global.locale.value = lang as any
    window.$mapi.config.set('lang', lang).then(() => {
        fireLocaleChange(lang)
    })
}

export const t = (key: string, param: object | null = null) => {
    const localeMessages = messages[i18n.global.locale.value] ?? messages[defaultLocale]
    if (!(key in localeMessages)) {
        if (window.__TEST_MODE__) console.warn('[i18n:missing]', `key="${key}" locale="${i18n.global.locale.value}"`)
        if (param) {
            return key.replace(/\{(\w+)\}/g, function (match, key) {
                return key in param ? (param as any)[key] : match
            })
        }
        return key
    }
    // @ts-ignore
    return i18n.global.t(key, param as any)
}
