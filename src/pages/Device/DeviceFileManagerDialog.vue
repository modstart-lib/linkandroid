<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'
import FileExt from '../../components/common/FileExt.vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {DeviceRecord, EnumDeviceStatus} from '../../types/Device'
import {useDeviceStore} from '../../store/modules/device'

type FileRecord = {
    checked: boolean
    name: string
    size: number
    isDirectory: boolean
    updateTime: string
}

const visible = ref(false)
const isEditPath = ref(false)
const device = ref({} as DeviceRecord)
const filePath = ref('')
const filePathEditing = ref('')
const fileRecords = ref<FileRecord[]>([])
const isListView = ref(true) // 默认显示列表视图
const inputRef = ref<HTMLInputElement | null>(null) // 输入框引用

// 排序状态：field=name|updateTime|size, order=asc|desc
type SortState = {field: string; order: 'asc' | 'desc'}
const currentSort = ref<SortState>({field: 'name', order: 'asc'})

const SORT_OPTIONS: {field: string; order: 'asc' | 'desc'; labelKey: string}[] = [
    {field: 'name', order: 'asc', labelKey: 'common.sortByName'},
    {field: 'name', order: 'desc', labelKey: 'common.sortByName'},
    {field: 'updateTime', order: 'asc', labelKey: 'common.sortByTime'},
    {field: 'updateTime', order: 'desc', labelKey: 'common.sortByTime'},
    {field: 'size', order: 'asc', labelKey: 'common.sortBySize'},
    {field: 'size', order: 'desc', labelKey: 'common.sortBySize'},
]

const getSortFieldLabelKey = (field: string) => {
    if (field === 'updateTime') return 'common.sortByTime'
    if (field === 'size') return 'common.sortBySize'
    return 'common.sortByName'
}

const setSort = (field: string, order: 'asc' | 'desc') => {
    currentSort.value = {field, order}
}

const show = (d: DeviceRecord) => {
    if (d.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    if (d.raw?.seedConnected) {
        Dialog.tipError(t('device.seedDeviceUnsupported'))
        return
    }
    visible.value = true
    device.value = d
    filePath.value = '/sdcard'
    doRefresh().then()
}

const filePathSeg = computed(() => {
    return filePath.value.split('/').filter((s) => s)
})

const isRootPath = computed(() => filePathSeg.value.length === 0)

const checkedFileRecords = computed(() => {
    return fileRecords.value.filter((f) => f.checked)
})

const checkedFileOnlyRecords = computed(() => {
    return fileRecords.value.filter((f) => f.checked && !f.isDirectory)
})

const sortedFileRecords = computed(() => {
    const {field, order} = currentSort.value
    return [...fileRecords.value].sort((a, b) => {
        if (field === 'updateTime') {
            const timeA = new Date(a.updateTime).getTime()
            const timeB = new Date(b.updateTime).getTime()
            return order === 'asc' ? timeA - timeB : timeB - timeA
        } else if (field === 'size') {
            return order === 'asc' ? a.size - b.size : b.size - a.size
        } else {
            return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        }
    })
})

const doRefresh = async () => {
    Dialog.loadingOn()
    try {
        const files = await window.$mapi.adb.fileList(device.value.id, filePath.value || '/')
        fileRecords.value = files.map((f) => {
            return {
                checked: false,
                name: f.name,
                size: f.size,
                isDirectory: f.type === 'directory',
                updateTime: f.updateTime,
            }
        })
    } catch (e: any) {
        Dialog.tipError(e.message || t('device.fileListError'))
    } finally {
        Dialog.loadingOff()
    }
}

const doOpen = (f: FileRecord) => {
    if (f.isDirectory) {
        filePath.value = (filePath.value.endsWith('/') ? filePath.value : filePath.value + '/') + f.name
        doRefresh().then()
    }
}

const doUp = () => {
    const segs = filePathSeg.value
    if (segs.length > 0) {
        segs.pop()
        filePath.value = '/' + segs.join('/')
        doRefresh().then()
    }
}

const doEditPath = async () => {
    isEditPath.value = true
    filePathEditing.value = filePath.value
    // 下一次tick后，输入框自动获取焦点
    await nextTick()
    inputRef.value?.focus()
}

const doEditPathConfirm = () => {
    filePath.value = filePathEditing.value
    isEditPath.value = false
    doRefresh().then()
}

const doDelete = async () => {
    await Dialog.confirm(t('device.fileDeleteConfirm'))
    const files = checkedFileRecords.value
    if (files.length === 0) {
        Dialog.tipError(t('device.fileSelectFirst'))
        return
    }
    Dialog.loadingOn(t('device.fileDeleting'))
    for (let f of files) {
        await window.$mapi.adb.fileDelete(device.value.id, filePath.value + '/' + f.name)
    }
    Dialog.loadingOff()
    Dialog.tipSuccess(t('device.fileDeleteSuccess'))
    doRefresh().then()
}

const doUpload = async () => {
    const path = await window.$mapi.file.openFile()
    if (path) {
        Dialog.loadingOn(t('device.fileUploading'))
        const fileName = window.$mapi.app.isPlatform('win') ? path.split('\\').pop() : path.split('/').pop()
        const devicePath = filePath.value + '/' + fileName
        await window.$mapi.adb.filePush(device.value.id, path, devicePath)
        Dialog.loadingOff()
        Dialog.tipSuccess(t('common.success'))
        doRefresh().then()
    }
}

const doDownload = async () => {
    const path = await window.$mapi.file.openDirectory()
    if (path) {
        const files = checkedFileRecords.value
        Dialog.loadingOn(t('status.downloading'))
        for (let f of files) {
            const sourcePath = filePath.value + '/' + f.name
            const targetPath = path + '/' + f.name
            if (f.isDirectory) {
                await downloadDirectory(device.value.id, sourcePath, targetPath)
            } else {
                await window.$mapi.adb.filePull(device.value.id, sourcePath, targetPath)
            }
        }
        Dialog.loadingOff()
        Dialog.tipSuccess(t('device.downloadSuccess'))
    }
}

const downloadDirectory = async (deviceId: string, sourcePath: string, targetPath: string) => {
    // 创建目标文件夹
    await window.$mapi.file.mkdir(targetPath, {isDataPath: false})
    // 获取源文件夹内容
    const files = await window.$mapi.adb.fileList(deviceId, sourcePath)
    for (let f of files) {
        const newSourcePath = sourcePath + '/' + f.name
        const newTargetPath = targetPath + '/' + f.name
        if (f.type === 'directory') {
            await downloadDirectory(deviceId, newSourcePath, newTargetPath)
        } else {
            await window.$mapi.adb.filePull(deviceId, newSourcePath, newTargetPath)
        }
    }
}

const toggleView = () => {
    isListView.value = !isListView.value
}

const toggleSortByName = () => {
    const {field, order} = currentSort.value
    if (field === 'name') {
        currentSort.value = {field: 'name', order: order === 'asc' ? 'desc' : 'asc'}
    } else {
        currentSort.value = {field: 'name', order: 'asc'}
    }
}

const toggleSortByModifiedTime = () => {
    const {field, order} = currentSort.value
    if (field === 'updateTime') {
        currentSort.value = {field: 'updateTime', order: order === 'asc' ? 'desc' : 'asc'}
    } else {
        currentSort.value = {field: 'updateTime', order: 'desc'}
    }
}

function testSeed() {
    visible.value = true
    isEditPath.value = false
    device.value = {
        id: 'test-device',
        name: t('device.testDevice'),
        type: 'usb',
        status: EnumDeviceStatus.CONNECTED,
    } as DeviceRecord
    filePath.value = '/sdcard'
    filePathEditing.value = ''
    fileRecords.value = [
        {
            checked: false,
            name: 'Download',
            size: 0,
            isDirectory: true,
            updateTime: '2024-01-01 10:00:00',
        },
        {
            checked: false,
            name: 'demo.txt',
            size: 12,
            isDirectory: false,
            updateTime: '2024-01-02 10:00:00',
        },
    ]
}

function selectFirst() {
    if (fileRecords.value[0]) fileRecords.value[0].checked = true
}

function testEditPath(path: string) {
    isEditPath.value = true
    filePathEditing.value = path
    filePath.value = path
    isEditPath.value = false
}

const deviceStore = useDeviceStore()

onMounted(() => {
    testActionSet('device.fileManager.show', () => {
        const record = deviceStore.records[0]
        if (record) show(record)
    })
    testActionSet('device.fileManager.seed', () => testSeed())
    testActionSet('device.fileManager.toggleView', () => toggleView())
    testActionSet('device.fileManager.sortByName', () => toggleSortByName())
    testActionSet('device.fileManager.sortByModifiedTime', () => toggleSortByModifiedTime())
    testActionSet('device.fileManager.sortBySizeAsc', () => setSort('size', 'asc'))
    testActionSet('device.fileManager.sortBySizeDesc', () => setSort('size', 'desc'))
    testActionSet('device.fileManager.sortByTimeAsc', () => setSort('updateTime', 'asc'))
    testActionSet('device.fileManager.editPath', (path: string) => testEditPath(path))
    testActionSet('device.fileManager.up', () => testEditPath(''))
    testActionSet('device.fileManager.selectFirst', () => selectFirst())
})

onUnmounted(() => {
    testActionUnset('device.fileManager.show')
    testActionUnset('device.fileManager.seed')
    testActionUnset('device.fileManager.toggleView')
    testActionUnset('device.fileManager.sortByName')
    testActionUnset('device.fileManager.sortByModifiedTime')
    testActionUnset('device.fileManager.sortBySizeAsc')
    testActionUnset('device.fileManager.sortBySizeDesc')
    testActionUnset('device.fileManager.sortByTimeAsc')
    testActionUnset('device.fileManager.editPath')
    testActionUnset('device.fileManager.up')
    testActionUnset('device.fileManager.selectFirst')
})

defineExpose({
    show,
    testSeed,
    doOpen,
    doUp,
    doEditPath,
    doEditPathConfirm,
    toggleView,
    toggleSortByName,
    toggleSortByModifiedTime,
    setSort,
    selectFirst,
    testEditPath,
})
</script>

<template>
    <a-modal v-model:visible="visible" width="80vw" :footer="false" title-align="start">
        <template #title>
            {{ $t('device.fileManager') }}
        </template>
        <div style="height: 60vh; margin: -0.5rem" class="">
            <div class="flex flex-col h-full">
                <div class="flex-shrink-0 flex items-center">
                    <div
                        v-if="!isEditPath"
                        class="border px-2 w-full h-10 border-solid border-gray-200 rounded flex items-center"
                    >
                        <a-button type="text" style="color: #999">
                            <template #icon>
                                <i-lucide-house />
                            </template>
                        </a-button>
                        <a-breadcrumb :max-count="4" class="flex-grow min-h-10" @click="doEditPath">
                            <a-breadcrumb-item v-if="isRootPath">/</a-breadcrumb-item>
                            <a-breadcrumb-item v-for="s in filePathSeg" :key="s">
                                {{ s }}
                            </a-breadcrumb-item>
                        </a-breadcrumb>
                    </div>
                    <div v-else class="h-10 w-full flex items-center">
                        <!-- 点击确认按钮、失去焦点都触发确认 -->
                        <a-input
                            ref="inputRef"
                            v-model="filePathEditing"
                            @pressEnter="doEditPathConfirm"
                            @blur="doEditPathConfirm"
                        >
                            <template #prepend>
                                <div class="cursor-pointer" @click="isEditPath = false">
                                    <i-lucide-x />
                                </div>
                            </template>
                            <template #append>
                                <div class="cursor-pointer" @click="doEditPathConfirm">
                                    <i-lucide-check />
                                </div>
                            </template>
                        </a-input>
                    </div>
                </div>
                <div class="py-2 flex items-center">
                    <a-button class="mr-1" @click="doUp" :disabled="filePathSeg.length === 0">
                        <template #icon>
                            <i-lucide-chevron-left />
                        </template>
                    </a-button>
                    <a-button class="mr-1" @click="doUpload">
                        <template #icon>
                            <i-lucide-upload />
                        </template>
                        {{ $t('common.addFile') }}
                    </a-button>
                    <a-button class="mr-1" @click="doDownload">
                        <template #icon>
                            <i-lucide-download />
                        </template>
                        {{ $t('common.download') }}
                    </a-button>
                    <a-button class="mr-1" @click="doDelete" :disabled="checkedFileRecords.length === 0">
                        <template #icon>
                            <i-lucide-trash-2 />
                        </template>
                        {{ $t('common.delete') }}
                    </a-button>
                    <a-button class="mr-1" @click="toggleView">
                        <template #icon>
                            <i-lucide-list v-if="isListView" />
                            <i-lucide-layout-grid v-else />
                        </template>
                        {{ isListView ? $t('common.viewGrid') : $t('common.viewList') }}
                    </a-button>
                    <a-dropdown trigger="click">
                        <a-button class="mr-1">
                            <template #icon>
                                <i-lucide-chevron-up v-if="currentSort.order === 'asc'" />
                                <i-lucide-chevron-down v-else />
                            </template>
                            {{ $t(getSortFieldLabelKey(currentSort.field)) }}
                        </a-button>
                        <template #content>
                            <a-doption
                                v-for="opt in SORT_OPTIONS"
                                :key="opt.field + '-' + opt.order"
                                @click="setSort(opt.field, opt.order)"
                            >
                                <template #icon>
                                    <i-lucide-check
                                        v-if="currentSort.field === opt.field && currentSort.order === opt.order"
                                    />
                                </template>
                                {{ $t(opt.labelKey) }}
                                <span v-if="opt.order === 'asc'">↑</span>
                                <span v-else>↓</span>
                            </a-doption>
                        </template>
                    </a-dropdown>
                </div>
                <div class="flex-grow overflow-auto border border-solid border-gray-200 rounded p-2">
                    <div v-if="isListView" class="flex flex-col">
                        <div
                            v-for="f in sortedFileRecords"
                            class="flex items-center border-b border-gray-200 p-2"
                            :key="f.name"
                        >
                            <div class="flex items-center flex-grow" @click="doOpen(f)" style="cursor: pointer">
                                <FileExt :is-folder="f.isDirectory" :name="f.name" size="30px" class="mr-2" />
                                <div class="flex-grow">
                                    <span class="font-medium">{{ f.name }}</span>
                                    <span class="text-gray-500 text-sm ml-2">({{ f.size }} bytes)</span>
                                    <span class="text-gray-400 text-sm ml-2">| {{ f.updateTime }}</span>
                                </div>
                            </div>
                            <div>
                                <a-checkbox v-model="f.checked" class="mr-2" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="flex flex-wrap">
                        <div v-for="f in sortedFileRecords" class="w-1/6 p-2" :key="f.name">
                            <div class="border border-solid border-gray-200 rounded-lg mb-2 p-2 relative">
                                <div class="text-center p-3 cursor-pointer" @click="doOpen(f)">
                                    <FileExt :is-folder="f.isDirectory" :name="f.name" size="60%" />
                                </div>
                                <div class="text-center text-sm" style="overflow: scroll">
                                    {{ f.name }}
                                </div>
                                <div class="absolute right-2 top-2">
                                    <a-checkbox v-model="f.checked" class="mr-2" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
