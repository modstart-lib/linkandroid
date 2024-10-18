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
}
