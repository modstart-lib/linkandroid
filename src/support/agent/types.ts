export type AgentLivePart =
    | {key: string; type: 'reasoning'; text: string}
    | {key: string; type: 'text'; text: string}
    | {key: string; type: 'image'; url: string; name?: string}
    | {key: string; type: 'tool'; name: string; status: string; input: any; output: string; durationMs?: number}

/** Images attached to a user message, stored as parts so a reopened session still shows them. */
export const imageParts = (parts?: AgentLivePart[]) =>
    (parts || [])
        .filter((part): part is Extract<AgentLivePart, {type: 'image'}> => part.type === 'image')
        .map((part, index) => ({
            key: part.key || `image-${index}`,
            url: part.url,
            name: part.name || `image-${index + 1}.png`,
        }))

/** Flatten a live session snapshot (progress channel) into renderable parts. */
export const buildLiveParts = (list: any[]): AgentLivePart[] => {
    const parts: AgentLivePart[] = []
    for (const message of Array.isArray(list) ? list : []) {
        if (!Array.isArray(message?.content)) continue
        for (const part of message.content) {
            if (part?.type === 'reasoning' || part?.type === 'text') {
                const text = String(part.text || '').trim()
                if (text) parts.push({key: `${message.id}-${part.type}-${parts.length}`, type: part.type, text})
            } else if (part?.type === 'tool') {
                const output = (part.state?.content || [])
                    .map((item: any) => String(item?.text || ''))
                    .join('\n')
                    .trim()
                // Live progress reports durationMs itself; a stored part only has times.
                const started = Number(part.time?.created || 0)
                const finished = Number(part.time?.completed || 0)
                const durationMs =
                    typeof part.durationMs === 'number'
                        ? part.durationMs
                        : started && finished && finished >= started
                          ? finished - started
                          : undefined
                parts.push({
                    key: `${message.id}-tool-${part.id || parts.length}`,
                    type: 'tool',
                    name: String(part.name || part.tool || 'tool'),
                    status: String(part.state?.status || ''),
                    input: part.state?.input || {},
                    output,
                    durationMs,
                })
            }
        }
    }
    return parts
}

export const toolInputText = (part: AgentLivePart) => {
    if (part.type !== 'tool') return ''
    const input = part.input || {}
    const keys = Object.keys(input)
    if (keys.length === 0) return ''
    return keys
        .map((key) => {
            const value = String(input[key] ?? '')
            return `${key}=${value.length > 40 ? `${value.slice(0, 40)}…` : value}`
        })
        .join(' ')
}
