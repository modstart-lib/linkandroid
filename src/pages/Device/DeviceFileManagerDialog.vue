<script setup lang="ts">
import {computed, ref, nextTick} from "vue";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import FileExt from "../../components/common/FileExt.vue";

const visible = ref(false);
const isEditPath = ref(false);
const device = ref({} as DeviceRecord);
const filePath = ref("");
const filePathEditing = ref("");
const fileRecords = ref([] as any[]);
const isListView = ref(true); // 默认显示列表视图
const sortOrderName = ref("asc"); // 默认按文件名升序
const sortOrderModifiedTime = ref("asc"); // 默认按修改时间升序
const currentSortField = ref("name"); // 当前排序字段
const inputRef = ref<HTMLInputElement | null>(null); // 输入框引用

const show = (d: DeviceRecord) => {
    if (d.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("设备未连接"));
        return;
    }
    visible.value = true;
    device.value = d;
    filePath.value = "";
    doRefresh().then();
};

const filePathSeg = computed(() => {
    return filePath.value.split("/").filter(s => s);
});

const checkedFileRecords = computed(() => {
    return fileRecords.value.filter(f => f.checked);
});

const checkedFileOnlyRecords = computed(() => {
    return fileRecords.value.filter(f => f.checked && !f.isDirectory);
});

const sortedFileRecords = computed(() => {
    // 根据当前的排序条件选择排序字段和方向
    const sortField = currentSortField.value;
    const sortOrder = sortField === "updateTime" ? sortOrderModifiedTime.value : sortOrderName.value;

    return [...fileRecords.value].sort((a, b) => {
        if (sortField === "updateTime") {
            const timeA = new Date(a.updateTime).getTime();
            const timeB = new Date(b.updateTime).getTime();
            return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
        } else {
            return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
    });
});

const doRefresh = async () => {
    Dialog.loadingOn();
    const files = await window.$mapi.adb.fileList(device.value.id, filePath.value || "/");
    Dialog.loadingOff();
    fileRecords.value = files.map(f => {
        return {
            checked: false,
            name: f.name,
            size: f.size,
            isDirectory: f.type === "directory",
            updateTime: f.updateTime,
        };
    });
};

const doOpen = (f: any) => {
    if (f.isDirectory) {
        filePath.value = filePath.value + "/" + f.name;
        doRefresh().then();
    }
};

const doUp = () => {
    const segs = filePathSeg.value;
    if (segs.length > 0) {
        segs.pop();
        filePath.value = "/" + segs.join("/");
        doRefresh().then();
    }
};

const doEditPath = async () => {
    isEditPath.value = true;
    filePathEditing.value = filePath.value;
    // 下一次tick后，输入框自动获取焦点
    await nextTick();
    inputRef.value?.focus();
};

const doEditPathConfirm = () => {
    filePath.value = filePathEditing.value;
    isEditPath.value = false;
    doRefresh().then();
};

const doDelete = async () => {
    await Dialog.confirm(t("确定删除选中的文件吗？"));
    const files = checkedFileRecords.value;
    if (files.length === 0) {
        Dialog.tipError(t("请选择文件"));
        return;
    }
    Dialog.loadingOn(t("正在删除"));
    for (let f of files) {
        await window.$mapi.adb.fileDelete(device.value.id, filePath.value + "/" + f.name);
    }
    Dialog.loadingOff();
    Dialog.tipSuccess(t("删除成功"));
    doRefresh().then();
};

const doUpload = async () => {
    const path = await window.$mapi.file.openFile();
    if (path) {
        Dialog.loadingOn(t("正在上传"));
        const fileName = window.$mapi.app.isPlatform("win") ? path.split("\\").pop() : path.split("/").pop();
        const devicePath = filePath.value + "/" + fileName;
        await window.$mapi.adb.filePush(device.value.id, path, devicePath);
        Dialog.loadingOff();
        Dialog.tipSuccess(t("上传成功"));
        doRefresh().then();
    }
};

const doDownload = async () => {
    const path = await window.$mapi.file.openDirectory();
    if (path) {
        const files = checkedFileRecords.value;
        Dialog.loadingOn(t("正在下载"));
        for (let f of files) {
            const sourcePath = filePath.value + "/" + f.name;
            const targetPath = path + "/" + f.name;
            if (f.isDirectory) {
                await downloadDirectory(device.value.id, sourcePath, targetPath);
            } else {
                await window.$mapi.adb.filePull(device.value.id, sourcePath, targetPath);
            }
        }
        Dialog.loadingOff();
        Dialog.tipSuccess(t("下载成功"));
    }
};

const downloadDirectory = async (deviceId: string, sourcePath: string, targetPath: string) => {
    // 创建目标文件夹
    await window.$mapi.file.mkdir(targetPath, {isDataPath: false});
    // 获取源文件夹内容
    const files = await window.$mapi.adb.fileList(deviceId, sourcePath);
    for (let f of files) {
        const newSourcePath = sourcePath + "/" + f.name;
        const newTargetPath = targetPath + "/" + f.name;
        if (f.type === "directory") {
            console.log("download directory:", sourcePath, targetPath);
            await downloadDirectory(deviceId, newSourcePath, newTargetPath);
        } else {
            console.log("download file:", sourcePath, targetPath);
            await window.$mapi.adb.filePull(deviceId, newSourcePath, newTargetPath);
        }
    }
};

defineExpose({
    show,
});

const toggleView = () => {
    isListView.value = !isListView.value;
};

const toggleSortByName = () => {
    currentSortField.value = "name";
    sortOrderName.value = sortOrderName.value === "asc" ? "desc" : "asc";
};

const toggleSortByModifiedTime = () => {
    currentSortField.value = "updateTime";
    sortOrderModifiedTime.value = sortOrderModifiedTime.value === "asc" ? "desc" : "asc";
};
</script>

<template>
    <a-modal v-model:visible="visible" width="80vw" :footer="false" title-align="start">
        <template #title>
            {{ $t("文件管理") }}
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
                                <icon-home />
                            </template>
                        </a-button>
                        <a-breadcrumb :max-count="4" class="flex-grow min-h-10" @click="doEditPath">
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
                                    <icon-close />
                                </div>
                            </template>
                            <template #append>
                                <div class="cursor-pointer" @click="doEditPathConfirm">
                                    <icon-check />
                                </div>
                            </template>
                        </a-input>
                    </div>
                </div>
                <div class="py-2 flex items-center">
                    <a-button class="mr-1" @click="doUp" :disabled="filePathSeg.length === 0">
                        <template #icon>
                            <icon-left />
                        </template>
                    </a-button>
                    <a-button class="mr-1" @click="doUpload">
                        <template #icon>
                            <icon-upload />
                        </template>
                        {{ $t("上传") }}
                    </a-button>
                    <a-button class="mr-1" @click="doDownload">
                        <template #icon>
                            <icon-download />
                        </template>
                        {{ $t("下载") }}
                    </a-button>
                    <a-button class="mr-1" @click="doDelete" :disabled="checkedFileRecords.length === 0">
                        <template #icon>
                            <icon-delete />
                        </template>
                        {{ $t("删除") }}
                    </a-button>
                    <a-button class="mr-1" @click="toggleView">
                        <template #icon>
                            <icon-list v-if="isListView" />
                            <icon-apps v-else />
                        </template>
                        {{ isListView ? $t("网格视图") : $t("列表视图") }}
                    </a-button>
                    <a-button class="mr-1" @click="toggleSortByName">
                        <template #icon>
                            <component :is="sortOrderName === 'asc' ? 'icon-down' : 'icon-up'" />
                        </template>
                        {{ $t("按文件名排序") }} ({{ sortOrderName === "asc" ? $t("降序") : $t("升序") }})
                    </a-button>
                    <a-button class="mr-1" @click="toggleSortByModifiedTime">
                        <template #icon>
                            <component :is="sortOrderModifiedTime === 'asc' ? 'icon-down' : 'icon-up'" />
                        </template>
                        {{ $t("按修改时间排序") }} ({{ sortOrderModifiedTime === "asc" ? $t("降序") : $t("升序") }})
                    </a-button>
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
