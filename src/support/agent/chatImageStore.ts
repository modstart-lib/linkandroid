/**
 * Chat screenshots live under <dataRoot>/chat-images/<sessionId>/ and are stored in
 * message parts as a relative path, so moving the data root keeps history working.
 * Older messages still hold inline data URLs and render unchanged.
 */
const CHAT_IMAGE_DIR = 'chat-images'

/** Decoded bytes of a data URL. */
const dataUrlBytes = (url: string) => {
    const comma = url.indexOf(',')
    const binary = window.atob(comma >= 0 ? url.slice(comma + 1) : url)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes
}

const imageExt = (url: string) => {
    const match = /^data:image\/([a-z0-9.+-]+)/i.exec(url)
    const ext = (match?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg')
    return ext.includes('+') ? 'svg' : ext
}

const mimeOf = (path: string) => {
    const ext = (path.split('.').pop() || 'jpg').toLowerCase()
    if (ext === 'svg') return 'image/svg+xml'
    if (ext === 'png') return 'image/png'
    if (ext === 'webp') return 'image/webp'
    if (ext === 'gif') return 'image/gif'
    return 'image/jpeg'
}

const toBase64 = (bytes: Uint8Array) => {
    let binary = ''
    const chunk = 0x8000
    for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
    }
    return window.btoa(binary)
}

/** Write one pasted image to disk; falls back to the data URL when the write fails. */
export const saveChatImage = async (sessionId: number, dataUrl: string) => {
    if (!sessionId || !dataUrl?.startsWith('data:')) return dataUrl
    try {
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${imageExt(dataUrl)}`
        const relative = `${CHAT_IMAGE_DIR}/${sessionId}/${name}`
        await window.$mapi.file.writeBuffer(relative, dataUrlBytes(dataUrl), {isDataPath: true})
        return relative
    } catch {
        return dataUrl
    }
}

const cache = new Map<string, string>()

/** Resolve a stored image to something <img src> can show; failures return ''. */
export const chatImageSrc = async (url: string) => {
    if (!url || url.startsWith('data:') || url.startsWith('http')) return url
    if (cache.has(url)) return cache.get(url) as string
    try {
        const buffer = await window.$mapi.file.readBuffer(url, {isDataPath: true})
        if (!buffer) return ''
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer?.data || buffer)
        const src = `data:${mimeOf(url)};base64,${toBase64(bytes)}`
        cache.set(url, src)
        return src
    } catch {
        return ''
    }
}
