import Showdown from 'showdown'

// Convert heading text to an HTML-safe anchor ID.
// Preserves CJK characters, replaces spaces/special chars with hyphens.
const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\- ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

const converter = new Showdown.Converter({
    tables: true,
    strikethrough: true,
    ghCodeBlocks: true,
})

export interface TocItem {
    id: string
    level: number
    text: string
    children: TocItem[]
}

/**
 * Parse markdown headings and build a table-of-contents tree.
 * Only `##` (level-2) and `###` (level-3) headings are included.
 * The returned IDs are slugified from heading text.
 */
export const parseToc = (markdown: string): TocItem[] => {
    const lines = markdown.split('\n')
    const root: TocItem[] = []
    const stack: TocItem[] = []
    const counters: Record<string, number> = {}

    for (const line of lines) {
        const match = line.match(/^(#{2,3})\s+(.+)$/)
        if (!match) continue
        const level = match[1].length // 2 or 3
        const text = match[2].trim()
        const baseId = slugify(text)
        if (!baseId) continue
        counters[baseId] = (counters[baseId] || 0) + 1
        const id = counters[baseId] > 1 ? `${baseId}-${counters[baseId]}` : baseId

        const item: TocItem = {id, level, text, children: []}

        // Pop stack until we find the right parent
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop()
        }
        if (stack.length > 0 && stack[stack.length - 1].level < level) {
            stack[stack.length - 1].children.push(item)
        } else {
            root.push(item)
        }
        stack.push(item)
    }

    return root
}

/**
 * Generate heading IDs and inject them into the HTML.
 * All heading /h2 and /h3 elements get a slug-based id attribute.
 */
const injectHeadingIds = (html: string): string => {
    const counters: Record<string, number> = {}
    return html.replace(
        /<h([23])([^>]*)>(.*?)<\/h\1>/g,
        (match: string, level: string, attrs: string, text: string) => {
            // Strip any inner HTML tags for the ID
            const plainText = text.replace(/<[^>]+>/g, '')
            const baseId = slugify(plainText)
            if (!baseId) return match
            counters[baseId] = (counters[baseId] || 0) + 1
            const id = counters[baseId] > 1 ? `${baseId}-${counters[baseId]}` : baseId
            // Preserve existing id if already set
            if (/id=/.test(attrs)) return match
            return `<h${level} id="${id}"${attrs}>${text}</h${level}>`
        },
    )
}

export const MarkdownUtil = {
    toHtml(markdown: string): string {
        const html = converter.makeHtml(markdown)
        return injectHeadingIds(html)
    },
}
