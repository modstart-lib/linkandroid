<script setup lang="ts">
import QRCode from "qrcode";
import { onBeforeUnmount, ref } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { mapError } from "../../lib/error";

const visible = ref(false);
const qrcodeUrl = ref("");
const pairingCode = ref("");
const countDown = ref(60);
const pairingStatus = ref<"waiting" | "pairing" | "connecting" | "connecting-fallback" | "connected" | "error">("waiting");
const statusMessage = ref("");
let countDownTimer: any = null;

const emit = defineEmits({
    update: () => true,
});

const show = async () => {
    visible.value = true;
    await startPairingService();
};

const hide = () => {
    visible.value = false;
    stopCountDown();
    qrcodeUrl.value = "";
    pairingCode.value = "";
    pairingStatus.value = "waiting";
    statusMessage.value = "";
};

const startPairingService = async () => {
    try {
        Dialog.loadingOn(t("device.generatingQrcode"));

        // 生成 6 位随机密码
        const password = Math.floor(100000 + Math.random() * 900000).toString();
        pairingCode.value = password;

        // 使用 escrcpy 格式的二维码
        const qrData = `WIFI:T:ADB;S:ADBQR-connectPhoneOverWifi;P:${password};;`;

        qrcodeUrl.value = await QRCode.toDataURL(qrData, {
            width: 400,
            height: 400,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#FFFFFF"
            }
        });

        Dialog.loadingOff();
        Dialog.tipSuccess(t("device.qrcodeGenerateSuccess"));
        startCountDown();

        // 启动自动扫描和配对
        pairingStatus.value = "waiting";
        statusMessage.value = t("device.waitingScanQRCode");

        console.log("开始扫描设备...", password);

        try {
            const result = await window.$mapi.adb.scannerConnect(password, (status: string, error?: string) => {
                console.log("配对状态更新:", status, error);
                if (status === "pairing") {
                    pairingStatus.value = "pairing";
                    statusMessage.value = t("device.pairingDevice");
                } else if (status === "connecting") {
                    pairingStatus.value = "connecting";
                    statusMessage.value = t("device.connectingDevice");
                } else if (status === "connecting-fallback") {
                    pairingStatus.value = "connecting-fallback";
                    statusMessage.value = t("device.connectingFallback");
                } else if (status === "connected") {
                    pairingStatus.value = "connected";
                    statusMessage.value = t("device.deviceConnectSuccess");
                } else if (status === "error") {
                    pairingStatus.value = "error";
                    statusMessage.value = error || t("device.pairingFailedShort");
                }
            });

            console.log("配对结果:", result);

            if (result.success) {
                Dialog.tipSuccess(t("device.qrcodePairingSuccess"));
                emit("update");
                setTimeout(() => {
                    hide();
                }, 1000);
            } else {
                Dialog.tipError(t("device.pairingFailedWithError", { error: result.error }));
            }
        } catch (connectError) {
            console.error("scannerConnect 调用异常:", connectError);
            Dialog.tipError(t("device.pairingProcessError", { error: connectError }));
            pairingStatus.value = "error";
            statusMessage.value = t("device.pairingProcessErrorShort");
        }

    } catch (error) {
        console.error("Generate pairing QR code error:", error);
        Dialog.loadingOff();
        Dialog.tipError(mapError(error));
        pairingStatus.value = "error";
        statusMessage.value = t("device.qrcodeGenerateFailed");
    }
};

const startCountDown = () => {
    countDown.value = 60;
    countDownTimer = setInterval(() => {
        countDown.value--;
        if (countDown.value <= 0) {
            stopCountDown();
            if (pairingStatus.value !== "connected") {
                Dialog.tipError(t("device.pairingTimeout"));
                hide();
            }
        }
    }, 1000);
};

const stopCountDown = () => {
    if (countDownTimer) {
        clearInterval(countDownTimer);
        countDownTimer = null;
    }
};

const regenerate = () => {
    stopCountDown();
    startPairingService();
};

onBeforeUnmount(() => {
    stopCountDown();
});

defineExpose({
    show,
    hide,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="54rem" title-align="start" @cancel="hide" :closable="false">
        <template #title>
            {{ $t("device.wirelessPairing") }}
        </template>
        <template #footer>
            <a-button @click="regenerate" type="outline">
                <template #icon>
                    <icon-refresh/>
                </template>
                {{ $t("device.regenerate") }}
            </a-button>
            <a-button @click="hide">
                {{ $t("common.close") }}
            </a-button>
        </template>
        <div style="max-height:calc(100vh - 15rem);" class="-mx-2 -my-4">
            <div v-if="qrcodeUrl && pairingCode" class="flex gap-2">
                <!-- Left: QR Code and Pairing Info -->
                <div class="left-panel flex-shrink-0" style="width: 25rem;">
                    <!-- Countdown Timer -->
                    <div class="mb-3 p-3 rounded-lg"
                         :class="countDown > 10 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'">
                        <div class="flex items-center justify-center gap-2">
                            <icon-clock-circle class="text-xl"
                                              :class="countDown > 10 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'"/>
                            <span class="text-2xl font-bold font-mono"
                                  :class="countDown > 10 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'">
                                {{ countDown }}s
                            </span>
                            <span class="text-sm text-gray-600 dark:text-gray-400">
                                {{ $t("device.timeRemaining") }}
                            </span>
                        </div>
                    </div>

                    <!-- QR Code -->
                    <div class="qrcode-container bg-white p-4 rounded-lg mb-3 text-center">
                        <img :src="qrcodeUrl" style="max-width:150px;" alt="Pairing QR Code" class="w-full mx-auto"/>
                    </div>

                    <!-- Pairing Code -->
                    <div class="pairing-info space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div class="text-center">
                            <div class="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 tracking-wider">
                                {{ pairingCode }}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">{{ $t("device.pairingCode") }}</div>
                        </div>

                        <!-- Status Display -->
                        <div class="border-t border-gray-200 dark:border-gray-700 pt-3">
                            <div class="flex items-center gap-2 text-sm">
                                <icon-loading v-if="pairingStatus === 'waiting' || pairingStatus === 'pairing' || pairingStatus === 'connecting' || pairingStatus === 'connecting-fallback'" class="animate-spin text-blue-600"/>
                                <icon-check-circle v-else-if="pairingStatus === 'connected'" class="text-green-600"/>
                                <icon-close-circle v-else-if="pairingStatus === 'error'" class="text-red-600"/>
                                <span class="font-medium"
                                      :class="{
                                          'text-blue-600': pairingStatus === 'waiting' || pairingStatus === 'pairing' || pairingStatus === 'connecting' || pairingStatus === 'connecting-fallback',
                                          'text-green-600': pairingStatus === 'connected',
                                          'text-red-600': pairingStatus === 'error'
                                      }">
                                    {{ statusMessage }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Instructions and Warnings -->
                <div class="right-panel flex-grow space-y-4">
                    <!-- Instructions -->
                    <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div class="text-sm text-blue-800 dark:text-blue-200">
                            <div class="font-semibold mb-3 flex items-center gap-2 text-base">
                                <icon-info-circle/>
                                {{ $t("device.usageInstructions") }}
                            </div>
                            <ol class="list-decimal list-inside space-y-2 text-blue-700 dark:text-blue-300">
                                <li>{{ $t("device.qrcodePairingInstructions1") }}</li>
                                <li>{{ $t("device.qrcodePairingInstructions2") }}</li>
                                <li>{{ $t("device.qrcodePairingInstructions3") }}</li>
                                <li>{{ $t("device.qrcodePairingInstructions4") }}</li>
                                <li>{{ $t("device.qrcodePairingInstructions5") }}</li>
                            </ol>
                        </div>
                    </div>

                    <!-- Warning -->
                    <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div class="text-sm text-amber-700 dark:text-amber-300">
                            <div class="font-semibold mb-3 flex items-center gap-2 text-base">
                                <icon-exclamation-circle/>
                                {{ $t("device.notes") }}
                            </div>
                            <ul class="list-disc list-inside space-y-1.5">
                                <li>{{ $t("device.qrcodePairingNote1") }}</li>
                                <li>{{ $t("device.qrcodePairingNote2") }}</li>
                                <li>{{ $t("device.qrcodePairingNote3") }}</li>
                                <li>{{ $t("device.qrcodePairingNote4") }}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped lang="less">
.qrcode-container {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    img {
        display: block;
    }
}

[data-theme="dark"] {
    .qrcode-container {
        background-color: #ffffff;
    }

    .pairing-info {
        background-color: rgba(255, 255, 255, 0.05);
    }
}
</style>
