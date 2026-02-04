<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {sleep, TimeUtil} from "../../lib/util";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";

const visible = ref(false);
const device = ref({} as DeviceRecord);
const recordData = ref({
    status: "idle",
    format: "mp4",
    devicePath: "",
    localTempDir: "",
    localTempMp4Path: null,
    resultPath: {
        mp4: "",
        gif: "",
    },
    startTimeInMs: 0,
    endTimeInMs: 0,
    duration: 0,
    mp4Param: {},
    gifParam: {
        fps: 10,
    },
} as {
    status: "idle" | "recording" | "converting" | "done" | "fail";
    format: "mp4" | "gif";
    devicePath: string | null;
    localTempDir: string | null;
    localTempMp4Path: string | null;
    resultPath: {
        mp4: string | null;
        gif: string | null;
    };
    startTimeInMs: number;
    endTimeInMs: number;
    duration: number;
    mp4Param: {};
    gifParam: {
        fps: number;
    };
});
const recordTime = computed(() => {
    return TimeUtil.secondsToTime(recordData.value.duration);
});
const show = (d: DeviceRecord) => {
    if (EnumDeviceStatus.CONNECTED !== d.status) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    device.value = d;
    recordData.value.status = "idle";
    recordData.value.format = "mp4";
    recordData.value.duration = 0;
    visible.value = true;
};

let recordController: any = null;

const doRecordStart = async () => {
    recordData.value.status = "recording";
    recordData.value.startTimeInMs = Date.now();
    recordData.value.endTimeInMs = 0;
    recordData.value.duration = 0;
    recordData.value.devicePath = null;
    recordData.value.localTempDir = null;
    recordData.value.localTempMp4Path = null;
    recordData.value.resultPath.mp4 = null;
    recordData.value.resultPath.gif = null;
    // console.log('doRecordStart.start')
    recordController = await $mapi.adb.screenrecord(device.value.id, {
        progress: (type: string, data: any) => {
            if (type === "success") {
                doRecordProcess().then();
            } else if (type === "error") {
                recordData.value.status = "fail";
            }
        },
    });
    recordData.value.devicePath = recordController.devicePath;
    // console.log('doRecordStart.end', recordController)
};

const doRecordStop = async () => {
    // console.log('doRecordStart.stop', recordController)
    if (recordController) {
        recordController.stop();
    }
};

const doRecordProcess = async () => {
    recordData.value.status = "converting";
    await sleep(1000);
    recordData.value.localTempDir = await $mapi.file.tempDir();
    const localTempMp4Path = recordData.value.localTempDir + "/record.mp4";
    await $mapi.adb.filePull(device.value.id, recordData.value.devicePath as string, localTempMp4Path);
    await $mapi.adb.fileDelete(device.value.id, recordData.value.devicePath as string);
    recordData.value.localTempMp4Path = localTempMp4Path;
    const resultPath = recordData.value.localTempDir + "/result." + recordData.value.format;
    try {
        switch (recordData.value.format) {
            case "mp4":
                await $mapi.app.spawnBinary('ffmpeg', [
                    "-i",
                    localTempMp4Path,
                    "-vcodec",
                    "libx264",
                    resultPath,
                ]);
                break;
            case "gif":
                await $mapi.app.spawnBinary('ffmpeg', [
                    "-i",
                    localTempMp4Path,
                    "-vf",
                    `fps=${recordData.value.gifParam.fps}`,
                    "-c:v",
                    "gif",
                    resultPath,
                ]);
                break;
            default:
                recordData.value.status = "fail";
                return;
        }
    } catch (e) {
        recordData.value.status = "fail";
        return;
    }
    if (!(await $mapi.file.exists(resultPath))) {
        recordData.value.status = "fail";
        return;
    }
    recordData.value.resultPath[recordData.value.format] = resultPath;
    recordData.value.status = "done";
};

const doRecordDownload = async () => {
    let path = await $mapi.file.openSave({
        defaultPath: t("device.record") + "_" + TimeUtil.datetimeString(),
    });
    if (!path) {
        return;
    }
    const formatRegx = new RegExp(`\.${recordData.value.format}$`);
    if (!formatRegx.test(path)) {
        path += "." + recordData.value.format;
    }
    if (await $mapi.file.exists(path)) {
        await $mapi.file.deletes(path);
    }
    let fromPath = recordData.value.resultPath[recordData.value.format] as string;
    await $mapi.file.copy(fromPath, path);
    Dialog.tipSuccess(t("device.downloadSuccess"));
};

const doClose = async () => {
    await $mapi.file.deletes(recordData.value.localTempDir as string);
    visible.value = false;
};

let durationRefreshTimer: any = null;
onMounted(() => {
    durationRefreshTimer = setInterval(() => {
        if (recordData.value.status === "recording") {
            recordData.value.endTimeInMs = Date.now();
            recordData.value.duration = Math.floor(
                (recordData.value.endTimeInMs - recordData.value.startTimeInMs) / 1000
            );
        }
    }, 1000);
});
onBeforeUnmount(() => {
    clearInterval(durationRefreshTimer);
});

defineExpose({
    show,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="40rem"
        :closable="false"
        :mask-closable="false"
        :footer="false"
        :esc-to-close="false"
        title-align="start"
    >
        <template #title>
            <div class="flex items-center">
                <div class="mr-2">
                    {{ $t("device.record") }}
                </div>
            </div>
        </template>
        <div>
            <div class="px-2 relative">
                <a-form v-if="recordData.status === 'idle'" :model="recordData" layout="vertical">
                    <a-form-item>
                        <a-radio-group v-model="recordData.format" type="button">
                            <a-radio value="mp4">MP4</a-radio>
                            <a-radio value="gif">GIF</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item>
                        <a-input-number
                            v-model="recordData.gifParam.fps"
                            :min="1"
                            :max="30"
                            :step="1"
                            v-if="recordData.format === 'gif'"
                        >
                            <template #prefix>
                                {{ $t("device.recordFps") }}
                            </template>
                            <template #append>
                                {{ $t("device.recordFpsUnit") }}
                            </template>
                        </a-input-number>
                    </a-form-item>
                    <a-form-item>
                        <a-button type="primary" class="mr-1" @click="doRecordStart">
                            <template #icon>
                                <i class="iconfont icon-video text-white"></i>
                            </template>
                            {{ $t("device.startRecord") }}
                        </a-button>
                        <a-button @click="visible = false" class="mr-1">
                            {{ $t("common.close") }}
                        </a-button>
                    </a-form-item>
                </a-form>
                <a-form v-else :model="recordData" layout="vertical">
                    <a-form-item>
                        <div class="flex">
                            <div class="mr-2">
                                <a-tag color="orange" size="large" v-if="recordData.status === 'recording'">
                                    {{ $t("device.recording") }}
                                </a-tag>
                                <a-tag color="red" size="large" v-else-if="recordData.status === 'converting'">
                                    {{ $t("device.recordProcessing") }}
                                </a-tag>
                                <a-tag color="red" size="large" v-else-if="recordData.status === 'fail'">
                                    {{ $t("device.recordFailed") }}
                                </a-tag>
                                <a-tag color="green" size="large" v-else-if="recordData.status === 'done'">
                                    {{ $t("device.recordSuccess") }}
                                </a-tag>
                            </div>
                            <div class="mr-2">
                                <a-tag size="large">
                                    {{ $t("device.recordFormat") }}
                                    {{ recordData.format.toUpperCase() }}
                                </a-tag>
                            </div>
                            <div class="mr-2">
                                <a-tag v-if="recordData.status === 'recording'" size="large">
                                    {{ $t("device.recorded", {time: recordTime}) }}
                                </a-tag>
                                <a-tag v-else-if="recordData.status === 'converting'" size="large">
                                    {{ $t("device.recordDuration", {time: recordTime}) }}
                                </a-tag>
                                <a-tag v-else-if="recordData.status === 'done'" size="large">
                                    {{ $t("device.recordDuration", {time: recordTime}) }}
                                </a-tag>
                                <a-tag v-else-if="recordData.status === 'fail'" size="large">
                                    {{ $t("device.recordDuration", {time: recordTime}) }}
                                </a-tag>
                            </div>
                            <div class="flex-grow">&nbsp;</div>
                        </div>
                    </a-form-item>
                    <a-form-item>
                        <a-button
                            v-if="recordData.status === 'recording'"
                            type="primary"
                            class="mr-1"
                            @click="doRecordStop"
                        >
                            <template #icon>
                                <i class="iconfont icon-stop text-white"></i>
                            </template>
                            {{ $t("device.stopRecord") }}
                        </a-button>
                        <a-button
                            v-if="['converting', 'fail', 'done'].includes(recordData.status)"
                            :disabled="['converting', 'fail'].includes(recordData.status)"
                            type="primary"
                            class="mr-1"
                            @click="doRecordDownload"
                        >
                            <template #icon>
                                <icon-down/>
                            </template>
                            {{ $t("device.downloadRecorded") }}
                        </a-button>
                        <a-button
                            @click="doClose"
                            :disabled="['recording', 'converting'].includes(recordData.status)"
                            class="mr-1"
                        >
                            {{ $t("common.close") }}
                        </a-button>
                    </a-form-item>
                </a-form>
            </div>
        </div>
    </a-modal>
</template>
