<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from "vue";
import QRCode from "qrcode";
import {ipcRenderer} from "electron";

const payUrl = ref<string>("");
const qrcodeExpireTime = ref<number>(0);
const status = ref<"" | "WaitPay" | "Scanned" | "Payed" | "Expired" | "Error">("");
const qrcodeExpireLeft = ref<number>(0);
const qrcodeUrl = ref<string>("");
const body = ref<string>("");

let countDownTimer = null as any;
let watchTimer = null as any;

onMounted(async () => {
    await doRefresh();
    countDownTimer = setInterval(() => {
        if (status.value !== "WaitPay") {
            return;
        }
        const left = Math.floor(qrcodeExpireTime.value - Date.now() / 1000);
        if (left <= 0) {
            clearInterval(countDownTimer);
            status.value = "Expired";
            return;
        }
        if (left < 60) {
            qrcodeExpireLeft.value = left;
        }
    }, 1000);
});

onBeforeUnmount(() => {
    clearInterval(countDownTimer);
    clearTimeout(watchTimer);
});

const doRefresh = async () => {
    const result = await ipcRenderer.invoke("Payment.Event", "refresh");
    status.value = "WaitPay";
    body.value = result.body;
    qrcodeExpireTime.value = (Date.now() + 1000 * result.payExpireSeconds) / 1000;
    qrcodeExpireLeft.value = 0;
    payUrl.value = result.payUrl;
    qrcodeUrl.value = await QRCode.toDataURL(payUrl.value, {
        width: 300,
        height: 300,
    });
    if (watchTimer) {
        clearTimeout(watchTimer);
    }
    doStartWatch().then();
};

const doStartWatch = async () => {
    const result = await ipcRenderer.invoke("Payment.Event", "watch");
    status.value = result.status;
    switch (result.status) {
        case "Scanned":
        case "WaitPay":
            watchTimer = setTimeout(() => {
                doStartWatch().then();
            }, 3000);
            break;
    }
};
</script>

<template>
    <div style="height: calc(100vh - 40px)" class="h-full relative">
        <div class="text-center pt-10">
            <div
                class="h-36 w-36 mx-auto rounded shadow-lg overflow-hidden border border-solid border-gray-200 relative"
            >
                <img class="h-36 w-36 rounded" v-if="qrcodeUrl" :src="qrcodeUrl" />
                <div v-if="status === 'Expired'" class="inset-0 bg-gray-900 absolute rounded bg-opacity-50 flex">
                    <div class="m-auto">
                        <div class="text-white pb-3">
                            <icon-info-circle />
                            二维码已过期
                        </div>
                        <div>
                            <a-button size="mini">
                                <template #icon>
                                    <icon-refresh />
                                </template>
                                刷新
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="pt-4 font-bold text-lg h-14">
                {{ body }}
            </div>
            <div class="pt-5 w-48 mx-auto h-14">
                <div v-if="status">
                    <div v-if="status === 'WaitPay' && qrcodeExpireLeft">{{ qrcodeExpireLeft }}秒内支付</div>
                    <div v-else-if="status === 'Scanned'" class="text-green-500"><icon-check /> 已扫码</div>
                    <div v-else-if="status === 'Payed'" class="text-green-500"><icon-check /> 已支付，即将关闭</div>
                    <div v-else-if="status === 'Error'" class="text-red-500">出错了</div>
                    <div v-else-if="status === 'Expired'" class="text-red-500">已过期</div>
                </div>
            </div>
            <div class="pt-5">
                <icon-qrcode />
                微信 / 支付宝 扫一扫
            </div>
        </div>
    </div>
</template>
