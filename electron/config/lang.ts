import source from "./../../src/lang/source.json";
import enUS from "./../../src/lang/en-US.json";
import zhCN from "./../../src/lang/zh-CN.json";
import {isDev} from "../lib/env";
import lang from "../mapi/lang/main";
import {ConfigMain} from "../mapi/config/main";

export const defaultLocale = 'zh-CN'

let locale = defaultLocale

export const langMessageList = [
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
    for (let m of langMessageList) {
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


let messages = buildMessages()

export const t = (text: string, param: object | null = null) => {
    if (messages[locale]) {
        if (messages[locale][text]) {
            if (param) {
                return messages[locale][text].replace(/\{(\w+)\}/g, function (match, key) {
                    return param[key] ? param[key] : match;
                });
            }
            return messages[locale][text]
        }
    }
    if (isDev) {
        console.warn('key not found, writing', locale, text, messages)
        lang.writeSourceKey(text).then(() => {
            console.info('writeSourceKey.success', locale, text)
        }).catch((e) => {
            console.error('writeSourceKey.error', locale, text, e)
        })
        lang.writeSourceKeyUse(text).then(() => {
        })
    }
    return text;
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
