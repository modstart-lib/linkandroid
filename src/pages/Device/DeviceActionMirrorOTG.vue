<script setup lang="ts">
import {ref} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {mapError} from "../../lib/error";
import {sleep} from "../../lib/util";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";

const props = defineProps<{
    device: DeviceRecord;
}>();

const mirrorController = ref(null as any);
const doMirror = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    Dialog.loadingOn(t("device.enteringOTG"));
    const args = ["--otg", "--always-on-top"];
    try {
        mirrorController.value = await $mapi.scrcpy.mirror(props.device.id, {
            title: props.device.name as string,
            args,
        });
        await sleep(1000);
        Dialog.tipSuccess(t("device.enterOTGSuccess"));
    } catch (error) {
        Dialog.tipError(mapError(error));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <a-doption @click="doMirror">
        {{ $t("device.enterOTGMode") }}
    </a-doption>
</template>

<style scoped></style>
