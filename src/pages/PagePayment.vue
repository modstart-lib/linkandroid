<script setup lang="ts">
import {ref} from 'vue'
import {Dialog} from '../lib/dialog'
import {mapError} from '../lib/error'
import {t} from '../lang'

const visible = ref(false)
const ipAddress = ref('')
const pairingPort = ref('')
const connectPort = ref('')
const pairingCode = ref('')
const isConnecting = ref(false)

const emit = defineEmits({
    update: () => true,
})

const show = () => {
    visible.value = true
    ipAddress.value = ''
    pairingPort.value = ''
    connectPort.value = ''
    pairingCode.value = ''
    isConnecting.value = false
}

const hide = () => {
    visible.value = false
    ipAddress.value = ''
    pairingPort.value = ''
    connectPort.value = ''
    pairingCode.value = ''
    isConnecting.value = false
}

const doConnect = async () => {
    if (!ipAddress.value) {
        Dialog.tipError(t('device.ipAddressRequired'))
        return
    }
    if (!pairingPort.value) {
        Dialog.tipError(t('device.pairingPortRequired'))
        return
    }
    if (!connectPort.value) {
        Dialog.tipError(t('device.connectPortRequired'))
        return
    }
    if (!pairingCode.value) {
        Dialog.tipError(t('device.pairingCodeRequired'))
        return
    }

    try {
        isConnecting.value = true
        Dialog.loadingOn(t('device.pairingConnecting'))

        const pairHost = `${ipAddress.value}:${pairingPort.value}`
        let pairSuccess = false
        let pairError = ''

        // 调用 adb pair 命令
        await window.$mapi.adb.pair(pairHost, pairingCode.value, {
            success: (data) => {
                console.log('Pairing success:', data)
                pairSuccess = true
            },
            error: (msg) => {
                console.error('Pairing failed:', msg)
                pairError = msg
            },
        })

        // 等待配对完成
        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (!pairSuccess) {
            throw new Error(pairError || t('device.pairingFailed'))
        }

        Dialog.tipSuccess(t('device.pairingSuccess'))

        // 配对成功后自动连接
        await window.$mapi.adb.connect(ipAddress.value, parseInt(connectPort.value))
        Dialog.tipSuccess(t('device.connectSuccessShort'))
        emit('update')
        hide()
    } catch (error) {
        console.error('Pairing code connect error:', error)
        Dialog.tipError(mapError(error))
    } finally {
        isConnecting.value = false
        Dialog.loadingOff()
    }
}

defineExpose({
    show,
    hide,
})
</script>

<template>
    <a-modal v-model:visible="visible" width="54rem" title-align="start" @cancel="hide" :closable="false">
        <template #title> {{ $t('device.pairingCodePairing') }} </template>
        <template #footer>
            <a-button @click="hide"> {{ $t('common.close') }} </a-button>
            <a-button type="primary" @click="doConnect" :loading="isConnecting">
                {{ $t('device.connectButton') }}
            </a-button>
        </template>
        <div style="max-height: calc(100vh - 15rem)" class="-mx-2 -my-4">
            <div class="flex gap-2">
                <!-- Left: Input Form -->
                <div class="left-panel flex-shrink-0 space-y-4" style="width: 25rem">
                    <!-- IP Address -->
                    <div>
                        <div class="mb-2 text-sm font-medium">{{ $t('device.ipAddress') }}</div>
                        <a-input
                            v-model="ipAddress"
                            :placeholder="$t('device.ipAddressPairPlaceholder')"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-computer />
                            </template>
                        </a-input>
                    </div>

                    <!-- Connect Port -->
                    <div>
                        <div class="mb-2 text-sm font-medium">
                            {{ $t('device.connectPort') }}
                            <span class="text-gray-400 text-xs font-normal">{{ $t('device.connectPortHint') }}</span>
                        </div>
                        <a-input
                            v-model="connectPort"
                            :placeholder="$t('device.connectPortPlaceholder')"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-import />
                            </template>
                        </a-input>
                    </div>

                    <!-- Pairing Port -->
                    <div>
                        <div class="mb-2 text-sm font-medium">
                            {{ $t('device.pairingPort') }}
                            <span class="text-gray-400 text-xs font-normal">{{ $t('device.pairingPortHint') }}</span>
                        </div>
                        <a-input
                            v-model="pairingPort"
                            :placeholder="$t('device.pairingPortPairPlaceholder')"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-export />
                            </template>
                        </a-input>
                    </div>

                    <!-- Pairing Code -->
                    <div>
                        <div class="mb-2 text-sm font-medium">{{ $t('device.pairingCode') }}</div>
                        <a-input
                            v-model="pairingCode"
                            :placeholder="$t('device.pairingCodePairPlaceholder')"
                            :disabled="isConnecting"
                            allow-clear
                        >
                            <template #prefix>
                                <icon-lock />
                            </template>
                        </a-input>
                    </div>

                    <!-- Connection Status (if connecting) -->
                    <div v-if="isConnecting" class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div class="flex items-center gap-2 text-sm">
                            <icon-loading class="animate-spin text-blue-600" />
                            <span class="font-medium text-blue-600">{{ $t('device.pairingConnecting') }}</span>
                        </div>
                    </div>
                </div>

                <!-- Right: Instructions and Warnings -->
                <div class="right-panel flex-grow space-y-4">
                    <!-- Instructions -->
                    <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div class="text-sm text-blue-800 dark:text-blue-200">
                            <div class="font-semibold mb-3 flex items-center gap-2 text-base">
                                <icon-info-circle />
                                {{ $t('device.pairingInstructions') }}
                            </div>
                            <ol class="list-decimal list-inside space-y-2 text-blue-700 dark:text-blue-300">
                                <li>{{ $t('device.pairingStep1') }}</li>
                                <li>{{ $t('device.pairingStep2') }}</li>
                                <li>{{ $t('device.pairingStep3') }}</li>
                                <li>{{ $t('device.pairingStep4') }}</li>
                                <li>{{ $t('device.pairingStep5') }}</li>
                                <li>{{ $t('device.pairingStep6') }}</li>
                            </ol>
                        </div>
                    </div>

                    <!-- Warning -->
                    <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div class="text-sm text-amber-700 dark:text-amber-300">
                            <div class="font-semibold mb-3 flex items-center gap-2 text-base">
                                <icon-exclamation-circle />
                                {{ $t('device.pairingNotice') }}
                            </div>
                            <ul class="list-disc list-inside space-y-1.5">
                                <li>{{ $t('device.pairingNoteItem1') }}</li>
                                <li>{{ $t('device.pairingNoteItem2') }}</li>
                                <li>{{ $t('device.pairingNoteItem3') }}</li>
                                <li>{{ $t('device.pairingNoteItem4') }}</li>
                                <li>{{ $t('device.pairingNoteItem5') }}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped lang="less"></style>
