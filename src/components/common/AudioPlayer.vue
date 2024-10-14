<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch, watchEffect} from "vue";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js'
import {TimeUtil} from "../../lib/util";
import {Dialog} from "../../lib/dialog";
import {AudioUtil} from "../../lib/audio";

const props = withDefaults(defineProps<{
    recordEnable?: boolean;
    trimEnable?: boolean;
    downloadEnable?: boolean;
    url?: string;
    lazyLoad?: boolean;
}>(), {
    recordEnable: false,
    trimEnable: false,
    downloadEnable: false,
    url: "",
    lazyLoad: false,
});

const isAudioEmpty = ref(false);
const isLoaded = ref(false);
const isManualPlay = ref(false);
const isAutoPlay = ref(false);
const wave = ref<WaveSurfer | null>(null);
const waveContainer = ref(null);
const waveUrl = ref<string | null>(null);
const isPlaying = ref(false);
const timeTotal = ref<number>(0);
const timeCurrent = ref<number>(0);
let regions = RegionsPlugin.create()
regions.enableDragSelection({
    color: 'rgba(255, 0, 0, 0.1)',
})

const waveRecord = ref<any>(null);
const isRecording = ref(false);
const recordDeviceSelect = ref(null);
const recordDevices = ref<{ id: string, name: string }[]>([]);
const isCutting = ref(false);

const timeTotalSecond = computed(() => {
    return Math.round(timeTotal.value);
});
const timeCurrentSecond = computed(() => {
    return Math.round(timeCurrent.value);
});
const timeTotalFormat = computed(() => {
    return TimeUtil.secondsToTime(timeTotalSecond.value);
});
const timeCurrentFormat = computed(() => {
    return TimeUtil.secondsToTime(timeCurrentSecond.value);
});

onMounted(() => {
    wave.value = WaveSurfer.create({
        container: waveContainer.value as any,
        waveColor: "#4A90E2",
        progressColor: "#FF5733",
        cursorColor: "#333",
        barWidth: 2,
        height: 40,
        plugins: [regions],
        autoplay: false,
        cursorWidth: 0,
    });
    waveRecord.value = wave.value.registerPlugin(RecordPlugin.create({
        scrollingWaveform: false,
        renderRecordedAudio: false
    }))
    waveRecord.value.on('record-end', (blob) => {
        waveUrl.value = URL.createObjectURL(blob)
    })
    wave.value.on("play", () => {
        isPlaying.value = true;
    });
    wave.value.on("pause", () => {
        isPlaying.value = false;
    });
    wave.value.on("finish", () => {
        isPlaying.value = false;
    });
    wave.value.on("interaction", () => {
        wave.value?.play()
    });
    wave.value.on("ready", () => {
        if (isAudioEmpty.value) {
            isAudioEmpty.value = false;
            return;
        }
        timeTotal.value = wave.value?.getDuration() as number;
        if (isAutoPlay.value) {
            wave.value?.play();
            isAutoPlay.value = false;
        }
    });
    wave.value.on("timeupdate", () => {
        timeCurrent.value = wave.value?.getCurrentTime() as number;
    });
    waveUrl.value = props.url;
    if (!waveUrl.value || props.lazyLoad) {
        isAudioEmpty.value = true;
        wave.value.loadBlob(AudioUtil.audioBufferToWavBlob(AudioUtil.audioBufferEmpty()));
    }
    if (props.recordEnable) {
        RecordPlugin.getAvailableAudioDevices().then((devices) => {
            recordDevices.value = devices.map((device) => {
                return {
                    id: device.deviceId,
                    name: device.label || device.deviceI
                }
            })
            if (!recordDeviceSelect.value) {
                if (devices.length > 0) {
                    recordDeviceSelect.value = devices[0].deviceId
                }
            }
        })
    }
});

onBeforeUnmount(() => {
    if (wave.value) {
        wave.value.destroy();
    }
});

watchEffect(() => {
    if (wave.value && waveUrl.value) {
        if (!props.lazyLoad || isManualPlay.value) {
            wave.value.load(waveUrl.value);
            isLoaded.value = true;
        }
    }
});

watch(() => props.url, (url) => {
    waveUrl.value = url;
});

const doLoadAndPlay = () => {
    isManualPlay.value = true;
    if (waveUrl.value) {
        isAutoPlay.value = true;
        wave.value?.load(waveUrl.value);
    }
};

const doPlay = () => {
    if (!isLoaded.value) {
        doLoadAndPlay();
        return
    }
    wave.value?.play();
};

const doPause = () => {
    wave.value?.pause();
};

const onSeek = (value: number) => {
    wave.value?.seekTo(value / timeTotal.value);
};

const doCutSubmit = async () => {
    if (!isCutting.value) {
        return
    }
    const region = regions.getRegions()[0];
    const buffer = AudioUtil.audioBufferCut(
        wave.value?.getDecodedData() as AudioBuffer,
        region.start,
        region.end,
    )
    isCutting.value = false;
    regions.clearRegions()
    // const trimmedBlob = bufferToBlob(buffer);
    waveUrl.value = URL.createObjectURL(AudioUtil.audioBufferToWavBlob(buffer));
    wave.value?.empty();
    wave.value?.load(waveUrl.value);
};

const doCut = async () => {
    if (!waveUrl.value) {
        return
    }
    let start = 1;
    let end = timeTotal.value - 1;
    if (end <= start) {
        start = 0
        end = timeTotal.value
    }
    regions.clearRegions()
    regions.addRegion({
        start,
        end,
        color: 'rgba(255, 255, 0, 0.1)',
        drag: true,
        resize: true,
    })
    isCutting.value = true;
};

const doDownload = () => {
    if (!waveUrl.value) {
        return
    }
    const a = document.createElement("a");
    a.href = waveUrl.value;
    a.download = "audio.wav";
    a.click();
};

const doRecordStart = async () => {
    if (waveRecord.value.isRecording() || waveRecord.value.isPaused()) {
        waveRecord.value.stopRecording()
        return
    }
    try {
        await waveRecord.value.startRecording({deviceId: recordDeviceSelect.value})
        isRecording.value = true;
    } catch (e) {
        console.error(e)
        Dialog.tipError((e as any).message)
    }
}

const doRecordStop = async () => {
    if (waveRecord.value.isRecording() || waveRecord.value.isPaused()) {
        await waveRecord.value.stopRecording()
        isRecording.value = false;
    }
}

const doRecordClean = async () => {
    waveUrl.value = null
    wave.value?.empty()
}
</script>

<template>
    <div class="border rounded-lg py-2">
        <div class="px-2 overflow-hidden" :style="(isLoaded||isRecording) ? 'height:40px;' : 'height:0;'">
            <div ref="waveContainer" style="height:40px;" class="w-full overflow-hidden"></div>
        </div>
        <div v-if="waveUrl" class="h-10 px-2 flex items-center">
            <div>
                <div v-if="!isPlaying"
                     @click="doPlay" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-play-circle class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                </div>
                <div v-if="isPlaying"
                     @click="doPause" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-pause-circle class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                </div>
            </div>
            <div class="ml-3 text-gray-500 w-24 text-sm">
                {{ timeCurrentFormat + '/' + timeTotalFormat }}
            </div>
            <div class="ml-3 flex-grow">
                <a-slider :model-value="timeCurrent"
                          :max="timeTotal"
                          @change="onSeek as any"
                          :min="0"/>
            </div>
            <div class="ml-3">
                <a-tooltip :content="$t('重新录制')">
                    <div v-if="!props.url"
                         @click="doRecordClean" class="cursor-pointer w-8 h-8 inline-flex">
                        <icon-refresh class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                    </div>
                </a-tooltip>
                <div v-if="!isCutting && props.trimEnable" @click="doCut" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-pen-fill class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                </div>
                <div v-if="isCutting && props.trimEnable" @click="doCutSubmit"
                     class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-check class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                </div>
                <div v-if="!isCutting && props.downloadEnable" @click="doDownload"
                     class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-download class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                </div>
            </div>
        </div>
        <div v-else-if="props.recordEnable" class="h-10 px-2 flex items-center">
            <div>
                <div v-if="!isRecording"
                     @click="doRecordStart" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-record class="m-auto text-red-700 hover:text-primary text-2xl"/>
                </div>
                <div v-else
                     @click="doRecordStop"
                     class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-record-stop class="m-auto text-gray-700 hover:text-primary text-2xl"/>
                </div>
            </div>
            <div class="ml-3">
                <a-select v-model="recordDeviceSelect as any" size="mini" style="width: 100%">
                    <a-option v-for="device in recordDevices" :key="device.id" :value="device.id">
                        {{ device.name }}
                    </a-option>
                </a-select>
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
