export type FileItem = {
    name: string
    isDirectory: boolean
    size: number
    lastModified: number
    path: string
    fullPath: string
    content: string
    contentBase64: string
    mode: number
}
