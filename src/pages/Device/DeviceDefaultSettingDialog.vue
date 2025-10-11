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
            {{ $t("默认设置") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ $t("保存") }}
            </a-button>
        </template>
        <div v-if="visible" class="-mx-5 -my-6">
            <div class="overflow-y-auto p-5" style="height: calc(80vh - 200px)">
                <div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t("投屏") }}
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("投屏时关闭屏幕") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.dimWhenMirror" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("投屏总在最上层") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.alwaysTop" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("投屏时转发声音") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.mirrorSound" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("显示预览图") }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.previewImage" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t("视频比特率") }}</div>
                            <div class="text-gray-400 text-xs">{{ $t("默认 8000000(8M)，支持支持单位 K、M") }}</div>
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
                        <div class="flex-grow">{{ $t("刷新率") }}</div>
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
                            {{ $t("自定义参数") }}
                            <a-tooltip :content="$t('该参数在投屏时会追加到scrcpy命令')">
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
