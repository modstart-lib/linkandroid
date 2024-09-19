import {createI18n} from "vue-i18n";

import {isDev} from "../lib/env";
import {StringUtil} from "../lib/util";

let localeInit = false
export const defaultLocale = 'zh-CN'

import source from "./source.json";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

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

const fileSyncer = {
    lock: {},
    readJson: async function (file: string) {
        if (this.lock[file]) {
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(this.readJson(file))
                }, 100)
            })
        }
        this.lock[file] = true
        const appEnv = await window.$mapi.app.appEnv()
        let filePath = window.$mapi.file.absolutePath([
            appEnv.appRoot,
            file,
        ].join('/'))
        const sourceContent = (await window.$mapi.file.read(filePath)) || '{}'
        this.lock[file] = sourceContent
        return JSON.parse(sourceContent)
    },
    writeJson: async function (file: string, data: any) {
        if (!this.lock[file]) {
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(this.writeJson(file, data))
                }, 100)
            })
        }
        const appEnv = await window.$mapi.app.appEnv()
        let filePath = window.$mapi.file.absolutePath([
            appEnv.appRoot,
            file,
        ].join('/'))
        const jsonString = JSON.stringify(data, null, 4)
        if (jsonString !== this.lock[file]) {
            await window.$mapi.file.write(filePath, jsonString)
        }
        this.lock[file] = false
    }
}

const writeSourceKey = async (key: string) => {
    const json = await fileSyncer.readJson('src/lang/source.json')
    const sourceIds = Object.values(json)
    if (!json[key]) {
        for (let i = 0; i < 10; i++) {
            const id = StringUtil.uuid().substring(0, 8)
            if (!sourceIds.includes(id)) {
                json[key] = id
                break
            }
        }
    }
    await fileSyncer.writeJson('src/lang/source.json', json)
    const locale = await getLocale()
    const jsonLang = await fileSyncer.readJson(`src/lang/${locale}.json`)
    jsonLang[json[key]] = key
    await fileSyncer.writeJson(`src/lang/${locale}.json`, jsonLang)
}

const writeSourceKeyUse = async (key: string) => {
    const json = await fileSyncer.readJson('src/lang/source-use.json')
    if (!json[key]) {
        json[key] = 1
    } else {
        json[key]++
    }
    await fileSyncer.writeJson('src/lang/source-use.json', json)
}
