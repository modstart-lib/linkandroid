/** 语言消息类型：扁平键值对 */
export type Messages = Record<string, string>

/** 语言模块：每个 .ts 文件 export default Messages */
export type LangLocale = 'en-US' | 'zh-CN'

/** 语言列表项 */
export type LocaleItem = {
    name: LangLocale | string
    label: string
    active?: boolean
}
