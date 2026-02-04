<script setup lang="ts">
import {ref} from "vue";
import SettingItemYesNo from "../../components/common/SettingItemYesNo.vue";
import {useSettingStore} from "../../store/modules/setting";

const setting = useSettingStore();
const visible = ref(false);
const formData = ref({
    dimWhenMirror: "",
    alwaysTop: "",
    mirrorSound: "",
    previewImage: "",
    videoBitRate: "",
    maxFps: "",
});
const show = async () => {
    formData.value.dimWhenMirror = setting.configGet("Device.dimWhenMirror", "no").value;
    formData.value.alwaysTop = setting.configGet("Device.alwaysTop", "no").value;
    formData.value.mirrorSound = setting.configGet("Device.mirrorSound", "no").value;
    formData.value.previewImage = setting.configGet("Device.previewImage", "no").value;
    visible.value = true;
};

const doSubmit = async () => {
    await setting.setConfig("Device.dimWhenMirror", formData.value.dimWhenMirror);
    await setting.setConfig("Device.alwaysTop", formData.value.alwaysTop);
    await setting.setConfig("Device.mirrorSound", formData.value.mirrorSound);
    await setting.setConfig("Device.previewImage", formData.value.previewImage);
    visible.value = false;
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="40rem" title-align="start">
        <template #title>
            <icon-mobile />
            {{ $t("device.defaultSettings") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ $t("common.save") }}
            </a-button>
        </template>
        <div v-if="visible" class="-mx-5 -my-6">
            <div class="overflow-y-auto p-5" style="height: calc(80vh - 200px)">
                <div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t("device.title") }}
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.dimWhenMirror") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.dimWhenMirror" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.alwaysTop") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.alwaysTop" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.mirrorSound") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.mirrorSound" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.previewImage") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.previewImage" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t("device.videoBitRate") }}</div>
                            <div class="text-gray-400 text-xs">{{ $t("device.videoBitRateHint") }}</div>
                        </div>
                        <div class="">
                            <a-input
                                :model-value="setting.configGet('Device.videoBitRate', '8M').value"
                                style="width: 10rem"
                                size="small"
                                @input="setting.onConfigChange('Device.videoBitRate', $event)"
                            >
                                <template #append>BPS</template>
                            </a-input>
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.maxFps") }}</div>
                        <div class="">
                            <a-input
                                :model-value="setting.configGet('Device.maxFps', '60').value"
                                style="width: 10rem"
                                size="small"
                                @input="setting.onConfigChange('Device.maxFps', $event)"
                            >
                                <template #append>FPS</template>
                            </a-input>
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            {{ $t("device.customArgs") }}
                            <a-tooltip :content="$t('device.customArgsHint')">
                                <icon-info-circle />
                            </a-tooltip>
                        </div>
                        <div class="">
                            <a-input
                                :model-value="setting.configGet('Device.scrcpyArgs', '').value"
                                style="width: 10rem"
                                size="small"
                                @input="setting.onConfigChange('Device.scrcpyArgs', $event)"
                            >
                            </a-input>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
