<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {ShellUtil, sleep, TimeUtil} from "../../lib/util";

const visible = ref(false)
const device = ref({} as DeviceRecord)
const recordData = ref({
    status: 'idle',
    format: 'mp4',
    devicePath: '',
    localTempDir: '',
    localTempMp4Path: null,
    resultPath: {
        mp4: '',
        gif: '',
    },
    startTimeInMs: 0,
    endTimeInMs: 0,
    duration: 0,
    mp4Param: {},
    gifParam: {
        fps: 10,
    }
} as {
    status: 'idle' | 'recording' | 'converting' | 'done' | 'fail',
    format: 'mp4' | 'gif',
    devicePath: string | null,
    localTempDir: string | null,
    localTempMp4Path: string | null,
    resultPath: {
        mp4: string | null,
        gif: string | null,
    },
    startTimeInMs: number,
    endTimeInMs: number,
    duration: number,
    mp4Param: {},
    gifParam: {
        fps: number,
    }
})
const recordTime = computed(() => {
    return TimeUtil.secondsToTime(recordData.value.duration)
})
const show = (d: DeviceRecord) => {
    if (EnumDeviceStatus.CONNECTED !== d.status) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    device.value = d
    recordData.value.status = 'idle'
    recordData.value.format = 'mp4'
    recordData.value.duration = 0
    visible.value = true
}

let recordController: any = null

const doRecordStart = async () => {
    recordData.value.status = 'recording'
    recordData.value.startTimeInMs = Date.now()
    recordData.value.endTimeInMs = 0
    recordData.value.duration = 0
    recordData.value.devicePath = null
    recordData.value.localTempDir = null
    recordData.value.localTempMp4Path = null
    recordData.value.resultPath.mp4 = null
    recordData.value.resultPath.gif = null
    console.log('doRecordStart.start')
    recordController = await window.$mapi.adb.screenrecord(device.value.id, {
        progress: (type: string, data: any) => {
            if (type === 'success') {
                doRecordProcess().then()
            }
        },
    })
    recordData.value.devicePath = recordController.devicePath
    console.log('doRecordStart.end', recordController)
}

const doRecordStop = async () => {
    console.log('doRecordStart.stop', recordController)
    if (recordController) {
        recordController.stop()
    }
}

const doRecordProcess = async () => {
    recordData.value.status = 'converting'
    await sleep(1000)
    recordData.value.localTempDir = await window.$mapi.file.tempDir()
    const localTempMp4Path = recordData.value.localTempDir + '/record.mp4'
    await window.$mapi.adb.filePull(device.value.id, recordData.value.devicePath as string, localTempMp4Path)
    await window.$mapi.adb.fileDelete(device.value.id, recordData.value.devicePath as string)
    recordData.value.localTempMp4Path = localTempMp4Path
    const resultPath = recordData.value.localTempDir + '/result.' + recordData.value.format
    try {
        switch (recordData.value.format) {
            case 'mp4':
                await window.$mapi.ffmpeg.run([
                    '-i', ShellUtil.quotaPath(localTempMp4Path),
                    '-vcodec', 'libx264',
                    ShellUtil.quotaPath(resultPath)
                ])
                break
            case 'gif':
                await window.$mapi.ffmpeg.run([
                    '-i', ShellUtil.quotaPath(localTempMp4Path),
                    '-vf', `fps=${recordData.value.gifParam.fps}`,
                    '-c:v', 'gif',
                    ShellUtil.quotaPath(resultPath)
                ])
                break
            default:
                recordData.value.status = 'fail'
                return
        }
    } catch (e) {
        recordData.value.status = 'fail'
        return
    }
    if (!await window.$mapi.file.exists(window.$mapi.file.absolutePath(resultPath))) {
        recordData.value.status = 'fail'
        return
    }
    recordData.value.resultPath[recordData.value.format] = resultPath
    recordData.value.status = 'done'
}

const doRecordDownload = async () => {
    let path = await window.$mapi.file.openSave({
        defaultPath: t('录屏') + '_' + TimeUtil.datetimeString()
    })
    if (!path) {
        return
    }
    const formatRegx = new RegExp(`\\.${recordData.value.format}$`)
    if (!formatRegx.test(path)) {
        path += '.' + recordData.value.format
    }
    const toPath = window.$mapi.file.absolutePath(path)
    if (await window.$mapi.file.exists(toPath)) {
        await window.$mapi.file.deletes(toPath)
    }
    let fromPath = window.$mapi.file.absolutePath(recordData.value.resultPath[recordData.value.format] as string)
    await window.$mapi.file.copy(fromPath, toPath)
    Dialog.tipSuccess(t('下载成功'))
}

const doClose = async () => {
    const tempDir = window.$mapi.file.absolutePath(recordData.value.localTempDir as string)
    await window.$mapi.file.deletes(tempDir)
    visible.value = false
}

let durationRefreshTimer: any = null
onMounted(() => {
    durationRefreshTimer = setInterval(() => {
        if (recordData.value.status === 'recording') {
            recordData.value.endTimeInMs = Date.now()
            recordData.value.duration = Math.floor((recordData.value.endTimeInMs - recordData.value.startTimeInMs) / 1000)
        }
    }, 1000)
})
onBeforeUnmount(() => {
    clearInterval(durationRefreshTimer)
})

defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="40rem"
             :closable="false"
             :mask-closable="false"
             :footer="false"
             :esc-to-close="false"
             title-align="start">
        <template #title>
            <div class="flex items-center">
                <div class="mr-2">
                    {{ $t('录制屏幕') }}
                </div>
            </div>
        </template>
        <div>
            <div class="px-2 relative">
                <a-form v-if="recordData.status==='idle'" :model="recordData" layout="vertical">
                    <a-form-item>
                        <a-radio-group v-model="recordData.format" type="button">
                            <a-radio value="mp4">MP4</a-radio>
                            <a-radio value="gif">GIF</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item>
                        <a-input-number v-model="recordData.gifParam.fps"
                                        :min="1"
                                        :max="30"
                                        :step="1"
                                        v-if="recordData.format==='gif'">
                            <template #prefix>
                                {{ $t('帧率') }}
                            </template>
                            <template #append>
                                {{ $t('帧/秒') }}
                            </template>
                        </a-input-number>
                    </a-form-item>
                    <a-form-item>
                        <a-button type="primary" class="mr-1"
                                  @click="doRecordStart">
                            <template #icon>
                                <i class="iconfont icon-video text-white"></i>
                            </template>
                            {{ $t('开始录制') }}
                        </a-button>
                        <a-button @click="visible = false"
                                  class="mr-1">
                            {{ $t('关闭') }}
                        </a-button>
                    </a-form-item>
                </a-form>
                <a-form v-else :model="recordData" layout="vertical">
                    <a-form-item>
                        <div class="flex">
                            <div class="mr-2">
                                <a-tag color="orange" size="large" v-if="recordData.status==='recording'">
                                    {{ $t('正在录制') }}
                                </a-tag>
                                <a-tag color="red" size="large" v-else-if="recordData.status==='converting'">
                                    {{ $t('正在处理') }}
                                </a-tag>
                                <a-tag color="red" size="large" v-else-if="recordData.status==='fail'">
                                    {{ $t('处理失败') }}
                                </a-tag>
                                <a-tag color="green" size="large" v-else-if="recordData.status==='done'">
                                    {{ $t('处理成功') }}
                                </a-tag>
                            </div>
                            <div class="mr-2">
                                <a-tag size="large">
                                    {{ $t('格式') }}
                                    {{ recordData.format.toUpperCase() }}
                                </a-tag>
                            </div>
                            <div class="mr-2">
                                <a-tag v-if="recordData.status==='recording'" size="large">
                                    {{ $t('已录制 {time}', {time: recordTime}) }}
                                </a-tag>
                                <a-tag v-else-if="recordData.status==='converting'" size="large">
                                    {{ $t('录制时长 {time}', {time: recordTime}) }}
                                </a-tag>
                                <a-tag v-else-if="recordData.status==='done'" size="large">
                                    {{ $t('录制时长 {time}', {time: recordTime}) }}
                                </a-tag>
                                <a-tag v-else-if="recordData.status==='fail'" size="large">
                                    {{ $t('录制时长 {time}', {time: recordTime}) }}
                                </a-tag>
                            </div>
                            <div class="flex-grow">
                                &nbsp;
                            </div>
                        </div>
                    </a-form-item>
                    <a-form-item>
                        <a-button v-if="recordData.status==='recording'"
                                  type="primary" class="mr-1"
                                  @click="doRecordStop">
                            <template #icon>
                                <i class="iconfont icon-stop text-white"></i>
                            </template>
                            {{ $t('停止录制') }}
                        </a-button>
                        <a-button v-if="['converting','fail','done'].includes(recordData.status)"
                                  :disabled="['converting','fail'].includes(recordData.status)"
                                  type="primary" class="mr-1"
                                  @click="doRecordDownload">
                            <template #icon>
                                <icon-down/>
                            </template>
                            {{ $t('下载已录制文件') }}
                        </a-button>
                        <a-button @click="doClose"
                                  :disabled="['recording','converting'].includes(recordData.status)"
                                  class="mr-1">
                            {{ $t('关闭') }}
                        </a-button>
                    </a-form-item>
                </a-form>
            </div>
        </div>
    </a-modal>
</template>

