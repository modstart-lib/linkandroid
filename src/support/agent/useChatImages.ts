import {computed, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'

export type ChatImage = {
    key: string
    url: string
    name: string
}

export const CHAT_IMAGE_MAX = 3
export const CHAT_IMAGE_MAX_EDGE = 1280
export const CHAT_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024

/** Bytes of the decoded payload of a data URL (base64 is 4 chars per 3 bytes). */
export const dataUrlBytes = (url: string) => {
    const comma = url.indexOf(',')
    const body = comma >= 0 ? url.slice(comma + 1) : url
    return Math.ceil((body.length * 3) / 4)
}

/** Shrink to the given longest edge and re-encode as JPEG; keeps the request small. */
export const compressChatImage = (dataUrl: string, maxEdge = CHAT_IMAGE_MAX_EDGE): Promise<string> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
            const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
            const width = Math.max(1, Math.round(image.width * scale))
            const height = Math.max(1, Math.round(image.height * scale))
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('canvas unavailable'))
                return
            }
            // Screenshots are opaque, but a transparent PNG would turn black in JPEG.
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(image, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        image.onerror = () => reject(new Error('image load failed'))
        image.src = dataUrl
    })

export const chatImageFiles = (images: ChatImage[]) =>
    images.map((image, index) => ({
        uri: image.url,
        source: {type: 'inline'},
        name: `image-${index + 1}.jpg`,
    }))

/** Shared paste/compress state for the two chat composers. */
export const useChatImages = () => {
    const images = ref<ChatImage[]>([])
    const hasImages = computed(() => images.value.length > 0)
    let processing = 0

    const addDataUrl = async (raw: string, name?: string) => {
        if (!raw) return false
        if (images.value.length + processing >= CHAT_IMAGE_MAX) {
            Dialog.tipError(t('chatImage.max', {count: CHAT_IMAGE_MAX}))
            return false
        }
        processing++
        try {
            const url = await compressChatImage(raw)
            if (dataUrlBytes(url) > CHAT_IMAGE_MAX_BYTES) {
                Dialog.tipError(t('chatImage.tooLarge'))
                return false
            }
            const label = String(name || '').trim() || `image-${images.value.length + 1}.png`
            images.value.push({key: `img_${Date.now()}_${images.value.length}`, url, name: label})
            return true
        } catch {
            Dialog.tipError(t('chatImage.failed'))
            return false
        } finally {
            processing--
        }
    }

    const addFile = async (file: File) => {
        const url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })
        return addDataUrl(url, file.name)
    }

    /** Returns true when the paste was consumed as an image. */
    const addFromPaste = async (event: ClipboardEvent) => {
        const files: File[] = []
        for (const item of Array.from(event.clipboardData?.items || [])) {
            if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
            const file = item.getAsFile()
            if (file) files.push(file)
        }
        if (files.length > 0) {
            event.preventDefault()
            for (const file of files) await addFile(file)
            return true
        }
        // Some Linux clipboard managers expose the bitmap only to the main process.
        if (!event.clipboardData?.types?.includes('Files')) return false
        event.preventDefault()
        const dataUrl = await window.$mapi.app.getClipboardImage()
        return addDataUrl(String(dataUrl || ''))
    }

    const removeImage = (index: number) => {
        images.value.splice(index, 1)
    }

    const clearImages = () => {
        images.value = []
    }

    return {images, hasImages, addDataUrl, addFile, addFromPaste, removeImage, clearImages}
}
