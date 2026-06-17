import {isDev} from '../lib/env'
import {ConfigMain} from '../mapi/config/main'

export const defaultLocale = 'zh-CN'

let locale = defaultLocale

// 自动发现所有语言模块（import.meta.glob 匹配 lang/en-US.ts 和 lang/zh-CN.ts）
const enUSModules = import.meta.glob('/src/**/lang/en-US.ts', {eager: true, import: 'default'})
const zhCNModules = import.meta.glob('/src/**/lang/zh-CN.ts', {eager: true, import: 'default'})

export const langMessageList = [
    {
        name: 'en-US',
        label: 'English',
        messages: Object.assign({}, ...Object.values(enUSModules)) as Record<string, string>,
    },
    {
        name: 'zh-CN',
        label: '简体中文', // language name in its own language, not translated
        messages: Object.assign({}, ...Object.values(zhCNModules)) as Record<string, string>,
    },
]

const buildMessages = (): any => {
    const messages: Record<string, any> = {}
    for (const m of langMessageList) {
        messages[m.name] = m.messages
    }
    return messages
}

let messages = buildMessages()

export const t = (text: string, param: object | null = null) => {
    if (messages[locale]) {
        if (messages[locale][text]) {
            if (param) {
                return messages[locale][text].replace(/\{(\w+)\}/g, function (match, key) {
                    return key in param ? (param as any)[key] : match
                })
            }
            return messages[locale][text]
        }
    }
    if (param) {
        return text.replace(/\{(\w+)\}/g, function (match, key) {
            return key in param ? (param as any)[key] : match
        })
    }
    return text
}

const readyAsync = async () => {
    locale = await ConfigMain.get('lang', defaultLocale)
}

const getLocale = () => {
    return locale
}

export const ConfigLang = {
    readyAsync,
    getLocale,
}
