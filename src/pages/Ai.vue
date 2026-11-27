<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'
import {t} from '../lang'
import {Dialog} from '../lib/dialog'
import {mapError} from '../lib/error'
import {testActionSet, testActionUnset} from '../utils/test'
import {useDeviceStore} from '../store/modules/device'
import {EnumDeviceStatus} from '../types/Device'
import OpencodeChat from '../support/ai/OpencodeChat.vue'
import VirtualList from '../components/common/VirtualList.vue'
import type {AgentSessionRecord} from '../support/agent/agentSession'
import {createAgentSession, deleteAgentSession, listAgentSessions} from '../support/agent/agentSession'

type SessionRecord = AgentSessionRecord

const deviceStore = useDeviceStore()
const sessions = ref<SessionRecord[]>([])
const activeId = ref<number>(0)
const selectedDeviceId = ref<string>('')
const searchKeywords = ref('')
const renameVisible = ref(false)
const renameValue = ref('')
const renameId = ref(0)
/** Mobile only: the session list stays collapsed so the conversation gets the full height. */
const mobileListOpen = ref(false)

const connectedDevices = computed(() =>
    deviceStore.records
        .filter((device) => device.status === EnumDeviceStatus.CONNECTED)
        .map((device) => ({
            value: device.id,
            label: device.name || device.raw?.model || device.id,
        })),
)

const activeSession = computed(() => sessions.value.find((item) => item.id === activeId.value) || null)

const filteredSessions = computed(() => {
    const keywords = searchKeywords.value.trim().toLowerCase()
    if (!keywords) return sessions.value
    return sessions.value.filter((session) => {
        const title = (session.title || t('ai.untitled')).toLowerCase()
        return title.includes(keywords) || (session.last_message || '').toLowerCase().includes(keywords)
    })
})

const timeText = (value: string) => {
    if (!value) return ''
    const time = new Date(value).getTime()
    if (Number.isNaN(time)) return value.slice(5, 16).replace('T', ' ')
    const date = new Date(time)
    const today = new Date()
    const sameDay =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    if (sameDay) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    if (date.getFullYear() !== today.getFullYear()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const deviceLabel = (deviceId: string) => {
    if (!deviceId) return t('ai.noDeviceSelected')
    const device = connectedDevices.value.find((item) => item.value === deviceId)
    return device?.label || deviceId
}

const messageCount = (session: SessionRecord) => Number(session.message_count || 0)
const previewText = (session: SessionRecord) => {
    const text = String(session.last_message || '')
        .replace(/\s+/g, ' ')
        .trim()
    if (text) return `${session.last_role === 'user' ? t('ai.me') + '：' : ''}${text}`
    if (messageCount(session) > 0) {
        return session.last_role === 'user' ? t('chatImage.message') : t('ai.stepsOnly')
    }
    return t('ai.noMessages')
}
const displayTitle = (session: SessionRecord) => session.title || t('ai.untitled')
const clearSearch = () => {
    searchKeywords.value = ''
}

const doSelectSession = (session: SessionRecord) => {
    activeId.value = session.id
    mobileListOpen.value = false
}

const loadSessions = async () => {
    sessions.value = await listAgentSessions({business: 'ai-chat', businessId: ''})
    if (!sessions.value.some((item) => item.id === activeId.value)) {
        activeId.value = sessions.value[0]?.id || 0
    }
}

const doNewSession = async () => {
    const id = await createAgentSession({
        business: 'ai-chat',
        businessId: '',
        deviceId: selectedDeviceId.value || '',
    })
    await loadSessions()
    activeId.value = id
    searchKeywords.value = ''
    mobileListOpen.value = false
    return id
}

const removeSession = async (session: SessionRecord) => {
    await deleteAgentSession(session.id)
    if (activeId.value === session.id) activeId.value = 0
    await loadSessions()
}

const doDeleteSession = async (session: SessionRecord) => {
    try {
        await Dialog.confirm(t('ai.deleteConfirm', {name: session.title || t('ai.untitled')}))
    } catch {
        return
    }
    await removeSession(session)
}

const doShowRename = (session: SessionRecord) => {
    renameId.value = session.id
    renameValue.value = session.title || ''
    renameVisible.value = true
}

const doRenameSession = async () => {
    const title = renameValue.value.trim()
    if (!renameId.value || !title) return
    try {
        await window.$mapi.db.update('UPDATE agent_chat_session SET title = ?, updated_at = ? WHERE id = ?', [
            title,
            new Date().toISOString(),
            renameId.value,
        ])
        renameVisible.value = false
        await loadSessions()
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}

watch(activeId, () => {
    const session = activeSession.value
    if (!session) return
    const online = connectedDevices.value.map((device) => device.value)
    selectedDeviceId.value = online.includes(session.device_id)
        ? session.device_id
        : online[0] || session.device_id || selectedDeviceId.value
})

watch(selectedDeviceId, async (value) => {
    if (!activeSession.value || !value) return
    await window.$mapi.db.update('UPDATE agent_chat_session SET device_id = ? WHERE id = ?', [
        value,
        activeSession.value.id,
    ])
})

onMounted(async () => {
    selectedDeviceId.value = connectedDevices.value[0]?.value || ''
    await loadSessions()
    if (sessions.value.length === 0) {
        await doNewSession()
    }
    testActionSet('ai.session.list', () => sessions.value)
    testActionSet('ai.session.new', () => doNewSession())
    testActionSet('ai.session.select', (id: number) => {
        activeId.value = Number(id)
    })
    testActionSet('ai.session.rename', async (arg: {id: number; title: string}) => {
        renameId.value = Number(arg.id)
        renameValue.value = arg.title
        await doRenameSession()
    })
    testActionSet('ai.session.delete', async (id: number) => {
        const session = sessions.value.find((item) => item.id === Number(id))
        if (!session) return
        await removeSession(session)
    })
    testActionSet('ai.session.search', (text: string) => {
        searchKeywords.value = text
    })
    testActionSet('ai.session.state', () => ({
        activeId: activeId.value,
        search: searchKeywords.value,
        sessions: sessions.value.map((item) => ({
            id: item.id,
            title: item.title,
            device_id: item.device_id,
            messages: messageCount(item),
        })),
    }))
})

onUnmounted(() => {
    testActionUnset('ai.session.list')
    testActionUnset('ai.session.new')
    testActionUnset('ai.session.select')
    testActionUnset('ai.session.rename')
    testActionUnset('ai.session.delete')
    testActionUnset('ai.session.search')
    testActionUnset('ai.session.state')
})
</script>

<template>
    <div class="flex flex-col h-[calc(100vh-2.5rem)] select-none">
        <div class="pb-header flex flex-wrap items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 shrink-0">
            <div class="text-2xl md:text-3xl font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
                <i-lucide-bot />
                {{ $t('ai.title') }}
            </div>
            <div class="ml-auto flex items-center gap-2 shrink-0 max-md:ml-0 max-md:w-full max-md:justify-end">
                <a-select
                    v-model="selectedDeviceId"
                    :placeholder="$t('ai.selectDevice')"
                    class="w-40 md:w-56 shrink-0"
                    allow-clear
                >
                    <a-option v-for="device in connectedDevices" :key="device.value" :value="device.value">
                        {{ device.label }}
                    </a-option>
                </a-select>
                <a-button
                    type="primary"
                    data-testid="ai-new-session"
                    class="shrink-0"
                    :title="$t('ai.newSession')"
                    :aria-label="$t('ai.newSession')"
                    @click="doNewSession"
                >
                    <template #icon><i-lucide-plus /></template>
                    <span class="hidden md:inline">{{ $t('ai.newSession') }}</span>
                </a-button>
            </div>
        </div>

        <div class="flex-1 min-h-0 flex flex-col md:flex-row border-t border-gray-200 dark:border-gray-800">
            <div
                class="w-full md:w-[22rem] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800"
                :class="mobileListOpen ? 'max-md:h-[46%]' : 'max-md:h-auto'"
            >
                <div class="shrink-0 px-3 pt-3 pb-2 space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {{ $t('ai.sessions') }}
                            <span class="text-gray-400">({{ sessions.length }})</span>
                        </span>
                        <button
                            type="button"
                            class="flex min-h-[44px] items-center gap-1 rounded pl-2 pr-0 text-[11px] text-gray-500 dark:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))] md:hidden"
                            :aria-expanded="mobileListOpen"
                            data-testid="ai-session-toggle"
                            @click="mobileListOpen = !mobileListOpen"
                        >
                            {{ mobileListOpen ? $t('ai.collapse') : $t('ai.expand') }}
                            <i-lucide-chevron-down
                                class="w-3.5 h-3.5 transition-transform"
                                :class="mobileListOpen ? 'rotate-180' : ''"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                    <div v-show="mobileListOpen" class="space-y-2 md:!block md:!h-full">
                        <a-input
                            v-model="searchKeywords"
                            :placeholder="$t('ai.searchSessions')"
                            allow-clear
                            data-testid="ai-session-search"
                        >
                            <template #prefix><i-lucide-search class="text-gray-400" /></template>
                        </a-input>
                    </div>
                </div>
                <VirtualList
                    v-if="filteredSessions.length > 0"
                    v-show="mobileListOpen"
                    :items="filteredSessions"
                    :item-key="(session) => session.id"
                    :estimated-height="96"
                    :gap="4"
                    :auto-stick-bottom="false"
                    class="flex-1 min-h-0 px-3 pb-2 md:!block"
                >
                    <template #default="{item: session}">
                        <div
                            class="group flex items-start gap-1.5 py-2 pl-2 pr-1 rounded-md cursor-pointer border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))]"
                            :class="
                                session.id === activeId
                                    ? 'bg-gray-100 dark:bg-gray-800 border-[rgb(var(--primary-6))]'
                                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60'
                            "
                            role="button"
                            tabindex="0"
                            :data-testid="`ai-session-${session.id}`"
                            @click="doSelectSession(session)"
                            @keydown.enter.prevent="doSelectSession(session)"
                        >
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="flex-1 min-w-0 truncate text-[13px] font-medium"
                                        :class="
                                            session.id === activeId
                                                ? 'text-gray-900 dark:text-gray-100'
                                                : 'text-gray-700 dark:text-gray-200'
                                        "
                                        :title="displayTitle(session)"
                                    >
                                        {{ displayTitle(session) }}
                                    </span>
                                    <span class="w-16 shrink-0 text-right text-[11px] tabular-nums text-gray-400">
                                        {{ timeText(session.updated_at) }}
                                    </span>
                                </div>
                                <div
                                    class="mt-0.5 text-xs leading-4 line-clamp-2 text-gray-500 dark:text-gray-400"
                                    :title="previewText(session)"
                                >
                                    {{ previewText(session) }}
                                </div>
                                <div
                                    v-if="messageCount(session) > 0 || session.model_id"
                                    class="mt-1 flex items-center gap-1.5 text-[11px] min-w-0"
                                    :class="
                                        session.id === activeId
                                            ? 'text-gray-600 dark:text-gray-300'
                                            : 'text-gray-500 dark:text-gray-400'
                                    "
                                >
                                    <span class="truncate min-w-0">{{ deviceLabel(session.device_id) }}</span>
                                    <span v-if="messageCount(session) > 0" class="shrink-0">
                                        · {{ $t('ai.messagesCount', {count: messageCount(session)}) }}
                                    </span>
                                    <span v-if="session.model_id" class="truncate font-mono min-w-0">
                                        · {{ session.model_id }}
                                    </span>
                                </div>
                            </div>
                            <a-dropdown trigger="click" position="br">
                                <a-button
                                    type="text"
                                    class="!w-8 !h-8 !p-0 shrink-0 !text-gray-400 hover:!text-gray-700 dark:!text-gray-400 dark:hover:!text-gray-200"
                                    :aria-label="$t('ai.moreActions')"
                                    @click.stop
                                >
                                    <template #icon><i-lucide-ellipsis class="w-4 h-4" /></template>
                                </a-button>
                                <template #content>
                                    <a-doption @click="doShowRename(session)">
                                        <template #icon><i-lucide-pencil /></template>
                                        {{ $t('ai.rename') }}
                                    </a-doption>
                                    <a-doption @click="doDeleteSession(session)">
                                        <template #icon><i-lucide-trash-2 /></template>
                                        {{ $t('ai.delete') }}
                                    </a-doption>
                                </template>
                            </a-dropdown>
                        </div>
                    </template>
                </VirtualList>
                <div
                    v-else
                    class="flex-1 flex flex-col items-center justify-center text-center px-4 gap-2 text-gray-400"
                >
                    <template v-if="searchKeywords">
                        <i-lucide-search-x class="text-3xl opacity-50" />
                        <div class="text-xs">{{ $t('ai.noSessionMatch') }}</div>
                        <a-button type="text" @click="clearSearch">{{ $t('ai.clearSearch') }}</a-button>
                    </template>
                    <template v-else>
                        <i-lucide-message-square-dashed class="text-3xl opacity-50" />
                        <div class="text-xs">{{ $t('ai.emptySessions') }}</div>
                        <a-button type="primary" @click="doNewSession">
                            <template #icon><i-lucide-plus /></template>
                            {{ $t('ai.newSession') }}
                        </a-button>
                    </template>
                </div>
            </div>

            <div class="flex-1 min-h-0 min-w-0 flex flex-col">
                <div
                    v-if="activeSession"
                    class="shrink-0 border-b border-gray-200 dark:border-gray-800"
                    data-testid="ai-chat-context"
                >
                    <div class="mx-auto flex h-9 w-full max-w-[44rem] items-center gap-2 px-2">
                        <i-lucide-message-circle class="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                        <span class="min-w-0 truncate text-xs font-medium">{{ displayTitle(activeSession) }}</span>
                        <span class="shrink-0 text-[11px] text-gray-400">·</span>
                        <span class="max-w-[7.5rem] shrink-0 truncate text-[11px] text-gray-400">
                            {{ deviceLabel(activeSession.device_id) }}
                        </span>
                        <span v-if="messageCount(activeSession) > 0" class="ml-auto shrink-0 text-[11px] text-gray-400">
                            {{ $t('ai.messagesCount', {count: messageCount(activeSession)}) }}
                        </span>
                    </div>
                </div>
                <OpencodeChat
                    v-if="activeSession"
                    :key="activeSession.id"
                    :session-id="activeSession.id"
                    :device-id="selectedDeviceId"
                    class="flex-1 min-h-0"
                    @changed="loadSessions"
                />
                <div v-else class="flex-1 flex items-center justify-center text-gray-400">
                    {{ $t('ai.emptySessions') }}
                </div>
            </div>
        </div>

        <a-modal v-model:visible="renameVisible" width="min(480px, 90vw)" :footer="false" title-align="start">
            <template #title>
                <div class="font-bold">{{ $t('ai.rename') }}</div>
            </template>
            <div class="py-2 flex flex-col gap-3">
                <a-input
                    v-model="renameValue"
                    :placeholder="$t('ai.renamePlaceholder')"
                    max-length="60"
                    data-testid="ai-session-rename-input"
                    @press-enter="doRenameSession"
                />
                <div class="flex justify-end gap-2">
                    <a-button @click="renameVisible = false">{{ $t('common.cancel') }}</a-button>
                    <a-button type="primary" data-testid="ai-session-rename-confirm" @click="doRenameSession">
                        {{ $t('common.confirm') }}
                    </a-button>
                </div>
            </div>
        </a-modal>
    </div>
</template>
