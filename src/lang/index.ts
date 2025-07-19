import {createI18n} from "vue-i18n";

import {isDev} from "../lib/env";
import source from "./source.json";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";
import jaJP from "./ja-JP.json";

let localeInit = false
export const defaultLocale = 'zh-CN'

export const messageList = [
    {
        name: 'en-US',
        label: 'English',
        messages: enUS
    },
    {
        name: 'zh-CN',
        label: '简体中文',
        messages: zhCN
    },
]
    {
        name: 'ja-JP',
        label: '日本語',
        messages: jaJP
    },
]

const buildMessages = (): any => {
    let messages = {}
    for (let m of messageList) {
        let msgList = {}
        for (let k in source) {
            const v = source[k]
            if (m.messages[v]) {
                msgList[k] = m.messages[v]
            }
        }
        messages[m.name] = msgList
    }
    return messages
}

const messages = buildMessages()

export const i18n = createI18n({
    locale: defaultLocale,
    legacy: false,
    globalInjection: true,
    messages
});

if (window.$mapi) {
    window.$mapi.config.get('lang', defaultLocale).then((lang: string) => {
        i18n.global.locale.value = lang as any
        localeInit = true
        fireLocaleChange(lang)
    })
}

export type LocaleItem = {
    name: string,
    label: string,
    active?: boolean
}

export const listLocales = () => {
    let list: LocaleItem[] = messageList
    list.forEach((item) => {
        item.active = i18n.global.locale.value === item.name
    })
    return list
}

export const getLocale = async () => {
    return new Promise<string>((resolve) => {
        if (localeInit) {
            resolve(i18n.global.locale.value)
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
    i18n.global.locale.value = lang as any
    window.$mapi.config.set('lang', lang).then(() => {
        fireLocaleChange(lang)
    })
}

export const t = (key: string, param: object | null = null) => {
    if (isDev) {
        getLocale().then((locale) => {
            if (!messages[locale][key]) {
                console.warn('key not found, writing', locale, key, messages)
                window.$mapi.lang.writeSourceKey(key).then(() => {
                    console.info('writeSourceKey.success', locale, key)
                }).catch((e) => {
                    console.error('writeSourceKey.error', locale, key, e)
                })
            }
        })
        window.$mapi.lang.writeSourceKeyUse(key).then(() => {
        })
    }
    // @ts-ignore
    return i18n.global.t(key, param as any)
}
