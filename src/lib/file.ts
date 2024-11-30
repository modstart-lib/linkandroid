export const FileUtil = {
    extensionToType(extension: string) {
        const mime = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
        }
        return mime[extension] || ''
    },
    bufferToBlob(buffer: ArrayBuffer, type: string) {
        if (!type.indexOf('/')) {
            type = this.extensionToType(type)
        }
        return new Blob([buffer], {type: type})
    },
    blobToFile(blob: Blob, name: string) {
        return new File([blob], name)
    },
    getExt(path: string) {
        const ext = path.lastIndexOf('.')
        if (ext >= 0) {
            return path.substring(ext + 1)
        }
        return ''
    },
    getBaseName(path: string, withExt: boolean = false) {
        // windows
        if (path.includes('\\')) {
            path = path.replace(/\\/g, '/')
        }
        const last = path.lastIndexOf('/')
        if (last >= 0) {
            path = path.substring(last + 1)
        }
        if (!withExt) {
            const ext = path.lastIndexOf('.')
            if (ext >= 0) {
                path = path.substring(0, ext)
            }
            return path
        }
        return path
    }
}
