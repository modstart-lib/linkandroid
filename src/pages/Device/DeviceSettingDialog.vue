<script setup lang="ts">
import {computed, ref} from "vue";
import SettingItemYesNoDefault from "../../components/common/SettingItemYesNoDefault.vue";
import {t} from "../../lang";
import {useDeviceStore} from "../../store/modules/device";
import {DeviceRecord} from "../../types/Device";

const deviceStore = useDeviceStore();
const visible = ref(false);
const formData = ref({
    dimWhenMirror: "",
    alwaysTop: "",
    mirrorSound: "",
    previewImage: "",
    videoBitRate: "",
    maxFps: "",
    scrcpyArgs: "",
});
const device = ref<DeviceRecord | null>(null);
const infoColumns = [
    {
        title: t("device.fieldName"),
        dataIndex: "name",
        width: 200,
    },
    {
        title: t("device.fieldValue"),
        dataIndex: "value",
    },
];

const deviceDataInfo = computed(() => {
    return Object.entries(device.value?.raw || {}).map(([name, value]) => {
        return {name, value};
    });
});
const show = (record: DeviceRecord) => {
    device.value = record;
    formData.value.dimWhenMirror = record.setting?.dimWhenMirror || "";
    formData.value.alwaysTop = record.setting?.alwaysTop || "";
    formData.value.mirrorSound = record.setting?.mirrorSound || "";
    formData.value.previewImage = record.setting?.previewImage || "";
    formData.value.videoBitRate = record.setting?.videoBitRate || "";
    formData.value.maxFps = record.setting?.maxFps || "";
    formData.value.scrcpyArgs = record.setting?.scrcpyArgs || "";
    visible.value = true;
};

const doSubmit = async () => {
    await deviceStore.updateSetting(device.value!.id, {
        dimWhenMirror: formData.value.dimWhenMirror,
        alwaysTop: formData.value.alwaysTop,
        mirrorSound: formData.value.mirrorSound,
        previewImage: formData.value.previewImage,
        videoBitRate: formData.value.videoBitRate,
        maxFps: formData.value.maxFps,
        scrcpyArgs: formData.value.scrcpyArgs,
    });
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
            {{ $t("device.settingsFor") }} {{ device?.id }}
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
                            <SettingItemYesNoDefault v-model="formData.dimWhenMirror" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.alwaysTop") }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.alwaysTop" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.mirrorSound") }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.mirrorSound" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.previewImage") }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.previewImage" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.videoBitRate") }}</div>
                        <div class="">
                            <a-input
                                v-model="formData.videoBitRate"
                                size="small"
                                :placeholder="$t('device.emptyConfigPlaceholder')"
                            />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t("device.maxFps") }}</div>
                        <div class="">
                            <a-input v-model="formData.maxFps" size="small" :placeholder="$t('device.emptyConfigPlaceholder')" />
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
                            <a-input v-model="formData.scrcpyArgs" size="small" :placeholder="$t('device.emptyConfigPlaceholder')" />
                        </div>
                    </div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t("device.other") }}
                    </div>
                    <div class="w-full">
                        <a-table
                            :columns="infoColumns"
                            size="small"
                            width="100%"
                            :data="deviceDataInfo"
                            :pagination="false"
                        />
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
