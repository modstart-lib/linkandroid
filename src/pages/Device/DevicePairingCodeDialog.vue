<script setup lang="ts">
import { ref } from "vue";
import { Dialog } from "../../lib/dialog";
import { mapError } from "../../lib/error";

const visible = ref(false);
const ipAddress = ref("");
const pairingPort = ref("");
const connectPort = ref("");
const pairingCode = ref("");
const isConnecting = ref(false);

const emit = defineEmits({
    update: () => true,
});

const show = () => {
    visible.value = true;
    ipAddress.value = "";
    pairingPort.value = "";
    connectPort.value = "";
    pairingCode.value = "";
    isConnecting.value = false;
};

const hide = () => {
    visible.value = false;
    ipAddress.value = "";
    pairingPort.value = "";
    connectPort.value = "";
    pairingCode.value = "";
    isConnecting.value = false;
};

const doConnect = async () => {
    if (!ipAddress.value) {
        Dialog.tipError("请输入IP地址");
        return;
    }
    if (!pairingPort.value) {
        Dialog.tipError("请输入配对端口");
        return;
    }
    if (!connectPort.value) {
        Dialog.tipError("请输入连接端口");
        return;
    }
    if (!pairingCode.value) {
        Dialog.tipError("请输入配对码");
        return;
    }

    try {
        isConnecting.value = true;
        Dialog.loadingOn("正在配对连接...");

        const pairHost = `${ipAddress.value}:${pairingPort.value}`;
        let pairSuccess = false;
        let pairError = "";

        // 调用adb pair命令
        await window.$mapi.adb.pair(pairHost, pairingCode.value, {
            success: (data) => {
                console.log("配对成功:", data);
                pairSuccess = true;
            },
            error: (msg) => {
                console.error("配对失败:", msg);
                pairError = msg;
            }
        });

        // 等待配对完成
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!pairSuccess) {
            throw new Error(pairError || "配对失败");
        }

        Dialog.tipSuccess("配对成功");

        // 配对成功后自动连接
        await window.$mapi.adb.connect(ipAddress.value, parseInt(connectPort.value));
        Dialog.tipSuccess("连接成功");
        emit("update");
        hide();
    } catch (error) {
        console.error("Pairing code connect error:", error);
        Dialog.tipError(mapError(error));
    } finally {
        isConnecting.value = false;
        Dialog.loadingOff();
    }
};

defineExpose({
    show,
    hide,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="54rem" title-align="start" @cancel="hide" :closable="false">
        <template #title>
            配对码配对
        </template>
        <template #footer>
            <a-button @click="hide">
                关闭
            </a-button>
            <a-button type="primary" @click="doConnect" :loading="isConnecting">
                连接
            </a-button>
        </template>
        <div style="max-height:calc(100vh - 15rem);" class="-mx-2 -my-4">
            <div class="flex gap-2">
                <!-- Left: Input Form -->
                <div class="left-panel flex-shrink-0 space-y-4" style="width: 25rem;">
                    <!-- IP Address -->
                    <div>
                        <div class="mb-2 text-sm font-medium">IP地址</div>
                        <a-input
                            v-model="ipAddress"
                            placeholder="例如: 192.168.1.100"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-computer/>
                            </template>
                        </a-input>
                    </div>

                    <!-- Connect Port -->
                    <div>
                        <div class="mb-2 text-sm font-medium">
                            连接端口
                            <span class="text-gray-400 text-xs font-normal">(无线调试页面顶部显示)</span>
                        </div>
                        <a-input
                            v-model="connectPort"
                            placeholder="例如: 44699"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-import/>
                            </template>
                        </a-input>
                    </div>

                    <!-- Pairing Port -->
                    <div>
                        <div class="mb-2 text-sm font-medium">
                            配对端口
                            <span class="text-gray-400 text-xs font-normal">(点击"使用配对码配对设备"后显示)</span>
                        </div>
                        <a-input
                            v-model="pairingPort"
                            placeholder="例如: 40181"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-export/>
                            </template>
                        </a-input>
                    </div>

                    <!-- Pairing Code -->
                    <div>
                        <div class="mb-2 text-sm font-medium">配对码</div>
                        <a-input
                            v-model="pairingCode"
                            placeholder="例如: 123456"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-lock/>
                            </template>
                        </a-input>
                    </div>

                    <!-- Connection Status (if connecting) -->
                    <div v-if="isConnecting" class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div class="flex items-center gap-2 text-sm">
                            <icon-loading class="animate-spin text-blue-600"/>
                            <span class="font-medium text-blue-600">正在配对连接...</span>
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
                                <li>记录顶部显示的<strong>IP地址和连接端口</strong>（例如 192.168.1.100:44699）</li>
                                <li>点击"使用配对码配对设备"</li>
                                <li>记录显示的<strong>配对端口和配对码</strong>（例如 40181 和 123456）</li>
                                <li>在左侧输入所有信息，点击"连接"按钮完成配对</li>
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
                                <li><strong>配对端口和连接端口是不同的</strong>，请仔细区分</li>
                                <li>配对码有效期通常为 60 秒</li>
                                <li>如果配对失败，请在手机上重新生成配对码</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped lang="less">
</style>
