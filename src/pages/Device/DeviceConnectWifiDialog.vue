<script setup lang="ts">
import {ref} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";

const visible = ref(false);
const formData = ref({
    host: "",
    port: "",
});
const show = () => {
    visible.value = true;
};
const emit = defineEmits({
    update: () => true,
});
const doSubmit = async () => {
    Dialog.loadingOn(t("device.testConnecting"));
    try {
        await window.$mapi.adb.connect(formData.value.host, parseInt(formData.value.port || "5555"));
        Dialog.tipSuccess(t("device.connectSuccessShort"));
        visible.value = false;
        emit("update");
    } catch (e) {
        Dialog.tipError(t("device.connectFailedShort"));
    } finally {
        Dialog.loadingOff();
    }
};
defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="40rem" title-align="start">
        <template #title>
            {{ $t("device.connectNetwork") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ $t("device.connect") }}
            </a-button>
        </template>
        <div>
            <div class="px-2">
                <a-form :model="formData" layout="vertical">
                    <a-form-item :label="$t('device.ipAddress')">
                        <a-input v-model="formData.host" placeholder="192.168.x.x" />
                    </a-form-item>
                    <a-form-item :label="$t('device.port')">
                        <a-input v-model="formData.port" :placeholder="$t('device.defaultPort', {port: 5555})" />
                    </a-form-item>
                </a-form>
            </div>
        </div>
    </a-modal>
</template>
