import {createI18n} from "vue-i18n";

import zhCN from './zh-CN';
import enUS from './en-US';

let localeInit = false
export const defaultLocale = 'zh-CN'

export const messages = {
    'zh-CN': zhCN,
    'en-US': enUS,
}

export const messageList = [
    {
        name: 'en-US',
        label: 'English',
    },
    {
        name: 'zh-CN',
        label: '简体中文',
    },
]

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
            let timer = setTimeout(() => {
                if (localeInit) {
                    clearTimeout(timer)
                    resolve(i18n.global.locale.value)
                }
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

export const i18nTrans = (key: string, param: object | null = null) => {
    return i18n.global.t(key, param as any)
}
