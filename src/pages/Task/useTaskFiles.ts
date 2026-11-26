/**
 * 任务项目文件（多文件编辑）状态管理。
 *
 * 任务目录里除入口文件外还可以放任意辅助文件；编辑器一次打开一个文件，
 * 未保存的修改按路径保存在 drafts 里，保存时统一写回项目目录。
 */
import {computed, ref} from 'vue'

export type TaskFileItem = {
    path: string
    size: number
    isDir: boolean
    updatedAt: string
}

const ENTRY_DEFAULT = 'main.py'
const HIDDEN_FILES = ['linkandroid.json']

export const useTaskFiles = () => {
    const entry = ref(ENTRY_DEFAULT)
    const files = ref<TaskFileItem[]>([])
    const activePath = ref(ENTRY_DEFAULT)
    const activeContent = ref('')
    /** 已保存到磁盘的内容快照 */
    const saved = ref<Record<string, string>>({})
    /** 有未保存修改的文件内容 */
    const drafts = ref<Record<string, string>>({})
    const loading = ref(false)

    const visibleFiles = computed(() =>
        files.value
            .filter((file) => !file.isDir && HIDDEN_FILES.indexOf(file.path) < 0)
            .sort((a, b) => {
                if (a.path === entry.value) return -1
                if (b.path === entry.value) return 1
                return a.path.localeCompare(b.path)
            }),
    )

    const dirtyPaths = computed(() => Object.keys(drafts.value).filter((path) => !!path))
    const hasDirty = computed(() => dirtyPaths.value.length > 0)
    const isEntry = (path: string) => path === entry.value
    const isDirty = (path: string) => Object.prototype.hasOwnProperty.call(drafts.value, path)

    /** 入口文件内容（数据库快照 / 运行 / AI 生成共用） */
    const entryCode = computed(() => {
        if (Object.prototype.hasOwnProperty.call(drafts.value, entry.value)) {
            return drafts.value[entry.value]
        }
        return saved.value[entry.value] ?? ''
    })

    const setActiveContent = (text: string) => {
        activeContent.value = text
        const path = activePath.value
        if (!path) return
        if ((saved.value[path] ?? '') === text) {
            if (Object.prototype.hasOwnProperty.call(drafts.value, path)) {
                const next = {...drafts.value}
                delete next[path]
                drafts.value = next
            }
            return
        }
        drafts.value = {...drafts.value, [path]: text}
    }

    const setEntryCode = (text: string) => {
        if (activePath.value === entry.value) {
            activeContent.value = text
        }
        drafts.value = {...drafts.value, [entry.value]: text}
    }

    /** 重置为某个任务的初始状态；id=0 时是尚未保存的新任务。 */
    const reset = (id: number, code: string, entryFile?: string) => {
        entry.value = entryFile || ENTRY_DEFAULT
        activePath.value = entry.value
        activeContent.value = code || ''
        if (id > 0) {
            // 已有任务：先用数据库快照兜底，随后 open(..., true) 会读磁盘覆盖
            saved.value = {[entry.value]: code || ''}
            drafts.value = {}
            files.value = []
        } else {
            saved.value = {[entry.value]: ''}
            drafts.value = code ? {[entry.value]: code} : {}
            files.value = [{path: entry.value, size: 0, isDir: false, updatedAt: ''}]
        }
    }

    const refresh = async (id: number) => {
        if (!id) return
        loading.value = true
        try {
            const info = await window.$mapi.project.pathInfo(id)
            if (info.entry) entry.value = info.entry
            files.value = await window.$mapi.project.listFiles(id)
        } finally {
            loading.value = false
        }
    }

    /** 打开一个文件；磁盘内容按需读取并缓存。 */
    const open = async (id: number, path: string, reload = false) => {
        if (!path) return
        if (!reload && activePath.value === path && activeContent.value !== '') return
        if (reload || !Object.prototype.hasOwnProperty.call(saved.value, path)) {
            saved.value = {
                ...saved.value,
                [path]: id > 0 ? await window.$mapi.project.readFile(id, path) : '',
            }
        }
        activePath.value = path
        activeContent.value = Object.prototype.hasOwnProperty.call(drafts.value, path)
            ? drafts.value[path]
            : (saved.value[path] ?? '')
    }

    /** 保存所有未保存的文件；返回入口文件内容。 */
    const saveAll = async (id: number) => {
        if (!id) throw new Error('TaskNotSaved')
        for (const [path, content] of Object.entries(drafts.value)) {
            if (!path) continue
            await window.$mapi.project.writeFile(id, path, content)
            saved.value = {...saved.value, [path]: content}
        }
        drafts.value = {}
        await refresh(id)
        return entryCode.value
    }

    const createFile = async (id: number, path: string) => {
        if (!id) throw new Error('TaskNotSaved')
        if (!path) throw new Error('FilePathRequired')
        if (files.value.some((file) => file.path === path)) throw new Error('FileExists')
        await window.$mapi.project.writeFile(id, path, '')
        saved.value = {...saved.value, [path]: ''}
        await refresh(id)
        await open(id, path)
    }

    const renameFile = async (id: number, fromPath: string, toPath: string) => {
        if (!id) throw new Error('TaskNotSaved')
        if (!toPath || fromPath === toPath) return
        if (files.value.some((file) => file.path === toPath)) throw new Error('FileExists')
        // 未保存内容先落盘，避免重命名后丢失
        if (isDirty(fromPath)) {
            await window.$mapi.project.writeFile(id, fromPath, drafts.value[fromPath])
            saved.value = {...saved.value, [fromPath]: drafts.value[fromPath]}
            const next = {...drafts.value}
            delete next[fromPath]
            drafts.value = next
        }
        await window.$mapi.project.renameFile(id, fromPath, toPath)
        if (saved.value[fromPath] !== undefined) {
            saved.value = {...saved.value, [toPath]: saved.value[fromPath]}
            const next = {...saved.value}
            delete next[fromPath]
            saved.value = next
        }
        if (activePath.value === fromPath) activePath.value = toPath
        await refresh(id)
        await open(id, toPath)
    }

    const removeFile = async (id: number, path: string) => {
        if (!id) throw new Error('TaskNotSaved')
        await window.$mapi.project.deleteFile(id, path)
        const savedNext = {...saved.value}
        delete savedNext[path]
        saved.value = savedNext
        if (Object.prototype.hasOwnProperty.call(drafts.value, path)) {
            const draftNext = {...drafts.value}
            delete draftNext[path]
            drafts.value = draftNext
        }
        await refresh(id)
        if (activePath.value === path) {
            await open(id, entry.value === path ? visibleFiles.value[0]?.path || '' : entry.value)
        }
    }

    /** 新建任务尚未保存时调用：把入口文件内容转成已保存状态。 */
    const markSaved = (code: string) => {
        saved.value = {...saved.value, [entry.value]: code}
        if (Object.prototype.hasOwnProperty.call(drafts.value, entry.value)) {
            const next = {...drafts.value}
            delete next[entry.value]
            drafts.value = next
        }
    }

    return {
        entry,
        files,
        visibleFiles,
        activePath,
        activeContent,
        dirtyPaths,
        hasDirty,
        loading,
        entryCode,
        isEntry,
        isDirty,
        reset,
        refresh,
        open,
        saveAll,
        createFile,
        renameFile,
        removeFile,
        setActiveContent,
        setEntryCode,
        markSaved,
    }
}
