<script setup lang="ts">
import {onMounted, onBeforeUnmount, ref} from "vue";
import QRCode from "qrcode";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {mapError} from "../../lib/error";

const visible = ref(false);
const qrcodeUrl = ref("");
const pairingInfo = ref<{
    ip: string;
    port: number;
    pairingCode: string;
} | null>(null);
const countDown = ref(60); // Pairing code valid for 60 seconds
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
    pairingInfo.value = null;
};

const startPairingService = async () => {
    try {
        Dialog.loadingOn(t("正在生成二维码"));

        // Get local IP address
        const networkInterfaces = await window.$mapi.misc.getNetworkInterfaces();

        if (!networkInterfaces || networkInterfaces.length === 0) {
            Dialog.tipError(t("没有获取到局域网连接地址，请检查网络"));
            hide();
            return;
        }

        // Use the first available non-internal IPv4 address
        const localIP = networkInterfaces[0].address;

        // Generate 6-digit pairing code
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Use a random port in the range 37000-44000 (typical Android pairing port range)
        const port = Math.floor(37000 + Math.random() * 7000);

        pairingInfo.value = {
            ip: localIP,
            port: port,
            pairingCode: pairingCode
        };

        // Generate QR code in Android Wireless Debugging format
        // Format: WIFI:T:ADB;S:<ip>:<port>;P:<pairing_code>;;
        const qrData = `WIFI:T:ADB;S:${localIP}:${port};P:${pairingCode};;`;

        qrcodeUrl.value = await QRCode.toDataURL(qrData, {
            width: 400,
            height: 400,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#FFFFFF"
            }
        });

        // Start ADB pairing server
        try {
            await window.$mapi.adb.pair(`${localIP}:${port}`, pairingCode, {
                success: (data) => {
                    Dialog.tipSuccess(t("配对成功"));
                    emit("update");
                    hide();
                },
                error: (msg) => {
                    console.warn("ADB pairing failed:", msg);
                    // Don't close dialog on error - user might try again
                }
            });
        } catch (error) {
            console.warn("ADB pairing service start warning:", error);
            // Continue even if service start fails, user can manually pair
        }

        Dialog.tipSuccess(t("二维码生成成功"));
        startCountDown();

    } catch (error) {
        console.error("Generate pairing QR code error:", error);
        Dialog.tipError(mapError(error));
        hide();
    } finally {
        Dialog.loadingOff();
    }
};

const startCountDown = () => {
    countDown.value = 60;
    countDownTimer = setInterval(() => {
        countDown.value--;
        if (countDown.value <= 0) {
            stopCountDown();
            Dialog.tipWarning(t("配对码已过期，请重新生成"));
            hide();
        }
    }, 1000);
};

const stopCountDown = () => {
    if (countDownTimer) {
        clearInterval(countDownTimer);
        countDownTimer = null;
    }
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        Dialog.tipSuccess(t("复制成功"));
    }).catch(() => {
        Dialog.tipError(t("复制失败"));
    });
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
            {{ $t("无线调试配对") }}
        </template>
        <template #footer>
            <a-button @click="regenerate" type="outline">
                <template #icon>
                    <icon-refresh/>
                </template>
                {{ $t("重新生成") }}
            </a-button>
            <a-button @click="hide">
                {{ $t("关闭") }}
            </a-button>
        </template>
        <div style="max-height:calc(100vh - 15rem);" class="-mx-2 -my-4">
            <div v-if="qrcodeUrl && pairingInfo" class="flex gap-2">
                <!-- Left: QR Code and Pairing Info -->
                <div class="left-panel flex-shrink-0" style="width: 20rem;">
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
                                {{ $t("配对码有效时间") }}
                            </span>
                        </div>
                    </div>

                    <!-- QR Code -->
                    <div class="qrcode-container bg-white p-4 rounded-lg mb-3 text-center">
                        <img :src="qrcodeUrl" style="max-width:150px;" alt="Pairing QR Code" class="w-full mx-auto"/>
                    </div>

                    <!-- Pairing Info -->
                    <div class="pairing-info space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div class="text-center">
                            <div class="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 tracking-wider">
                                {{ pairingInfo.pairingCode }}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">{{ $t("配对码") }}</div>
                        </div>

                        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2 text-sm">
                            <div class="space-y-1">
                                <div class="text-gray-600 dark:text-gray-400">{{ $t("电脑IP地址") }}</div>
                                <div class="flex items-center gap-2">
                                    <span class="font-mono font-semibold flex-grow">{{ pairingInfo.ip }}</span>
                                    <a-button size="mini" @click="copyToClipboard(pairingInfo.ip)">
                                        <template #icon>
                                            <icon-copy/>
                                        </template>
                                    </a-button>
                                </div>
                            </div>
                            <div class="space-y-1">
                                <div class="text-gray-600 dark:text-gray-400">{{ $t("配对端口") }}</div>
                                <div class="flex items-center gap-2">
                                    <span class="font-mono font-semibold flex-grow">{{ pairingInfo.port }}</span>
                                    <a-button size="mini" @click="copyToClipboard(pairingInfo.port.toString())">
                                        <template #icon>
                                            <icon-copy/>
                                        </template>
                                    </a-button>
                                </div>
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
                                {{ $t("使用说明：") }}
                            </div>
                            <ol class="list-decimal list-inside space-y-2 text-blue-700 dark:text-blue-300">
                                <li>{{ $t("打开手机【设置】→【开发者选项】→【无线调试】") }}</li>
                                <li>{{ $t("点击【使用配对码配对设备】") }}</li>
                                <li>{{ $t("使用手机扫描此二维码") }}</li>
                                <li>{{ $t("或手动输入配对码和IP地址") }}</li>
                                <li>{{ $t("配对成功后设备将自动出现在列表中") }}</li>
                            </ol>
                        </div>
                    </div>

                    <!-- Warning -->
                    <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div class="text-sm text-amber-700 dark:text-amber-300">
                            <div class="font-semibold mb-3 flex items-center gap-2 text-base">
                                <icon-exclamation-circle/>
                                {{ $t("注意事项：") }}
                            </div>
                            <ul class="list-disc list-inside space-y-1.5">
                                <li>{{ $t("确保手机和电脑在同一局域网") }}</li>
                                <li>{{ $t("需要Android 11或更高版本") }}</li>
                                <li>{{ $t("配对码60秒内有效") }}</li>
                                <li>{{ $t("首次使用需要在手机上启用【开发者选项】和【无线调试】") }}</li>
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
