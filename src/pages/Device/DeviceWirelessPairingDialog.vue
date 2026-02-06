<script setup lang="ts">
import QRCode from "qrcode";
import { onBeforeUnmount, ref } from "vue";
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
        Dialog.loadingOn("生成配对二维码...");

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
        Dialog.tipSuccess("二维码生成成功");
        startCountDown();

        // 启动自动扫描和配对
        pairingStatus.value = "waiting";
        statusMessage.value = "等待手机扫描二维码...";

        console.log("开始扫描设备...", password);

        try {
            const result = await window.$mapi.adb.scannerConnect(password, (status: string, error?: string) => {
                console.log("配对状态更新:", status, error);
                if (status === "pairing") {
                    pairingStatus.value = "pairing";
                    statusMessage.value = "正在配对设备...";
                } else if (status === "connecting") {
                    pairingStatus.value = "connecting";
                    statusMessage.value = "正在连接设备...";
                } else if (status === "connecting-fallback") {
                    pairingStatus.value = "connecting-fallback";
                    statusMessage.value = "尝试备用连接方式...";
                } else if (status === "connected") {
                    pairingStatus.value = "connected";
                    statusMessage.value = "设备连接成功！";
                } else if (status === "error") {
                    pairingStatus.value = "error";
                    statusMessage.value = error || "配对失败";
                }
            });

            console.log("配对结果:", result);

            if (result.success) {
                Dialog.tipSuccess("二维码配对成功");
                emit("update");
                setTimeout(() => {
                    hide();
                }, 1000);
            } else {
                Dialog.tipError(`配对失败: ${result.error}`);
            }
        } catch (connectError) {
            console.error("scannerConnect 调用异常:", connectError);
            Dialog.tipError(`配对过程出错: ${connectError}`);
            pairingStatus.value = "error";
            statusMessage.value = "配对过程出错";
        }

    } catch (error) {
        console.error("Generate pairing QR code error:", error);
        Dialog.loadingOff();
        Dialog.tipError(mapError(error));
        pairingStatus.value = "error";
        statusMessage.value = "生成二维码失败";
    }
};

const startCountDown = () => {
    countDown.value = 60;
    countDownTimer = setInterval(() => {
        countDown.value--;
        if (countDown.value <= 0) {
            stopCountDown();
            if (pairingStatus.value !== "connected") {
                Dialog.tipError("配对超时");
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
            二维码配对
        </template>
        <template #footer>
            <a-button @click="regenerate" type="outline">
                <template #icon>
                    <icon-refresh/>
                </template>
                重新生成
            </a-button>
            <a-button @click="hide">
                关闭
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
                                剩余时间
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
                            <div class="text-xs text-gray-500 mt-1">配对码</div>
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
                                使用说明
                            </div>
                            <ol class="list-decimal list-inside space-y-2 text-blue-700 dark:text-blue-300">
                                <li>在手机上打开"开发者选项"</li>
                                <li>启用"无线调试"功能</li>
                                <li>点击"使用配对码配对设备"</li>
                                <li>使用手机扫描左侧二维码即可自动配对</li>
                                <li>配对成功后，设备将自动连接</li>
                            </ol>
                        </div>
                    </div>

                    <!-- Warning -->
                    <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div class="text-sm text-amber-700 dark:text-amber-300">
                            <div class="font-semibold mb-3 flex items-center gap-2 text-base">
                                <icon-exclamation-circle/>
                                注意事项
                            </div>
                            <ul class="list-disc list-inside space-y-1.5">
                                <li>确保手机和电脑在同一局域网内</li>
                                <li>需要 Android 11 及以上版本</li>
                                <li>配对码有效期为 60 秒</li>
                                <li>如果配对失败，请点击"重新生成"按钮</li>
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
