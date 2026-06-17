<script setup lang="ts">
import {ref} from 'vue'
import {t} from '../../lang'

const showFullDoc = ref(false)

const commands = [
    {name: 'linkandroid --help', desc: 'cli.cmdHelpDesc'},
    {name: 'linkandroid version', desc: 'cli.cmdVersionDesc'},
    {name: 'linkandroid devices', desc: 'cli.cmdDevicesDesc'},
    {name: 'linkandroid task list', desc: 'cli.cmdTaskListDesc'},
    {name: 'linkandroid task get <id>', desc: 'cli.cmdTaskGetDesc'},
    {name: 'linkandroid task run <id>', desc: 'cli.cmdTaskRunDesc'},
    {name: 'linkandroid task history <id>', desc: 'cli.cmdTaskHistoryDesc'},
]

const authConfigPaths = [
    '~/.linkandroid/client.json      ← 入口配置（dataPath）',
    '~/.linkandroid/data/cli-auth.json  ← HTTP 认证信息',
]
const authConfigContent = JSON.stringify({port: 12345, token: 'your-auth-token'}, null, 2)

const doCopy = async (text: string) => {
    try {
        await window.$mapi.app.setClipboardText(text)
        window.$mapi.app.toast(t('common.copySuccess'))
    } catch {
        // fallback
    }
}
</script>

<template>
    <div class="max-w-2xl">
        <!-- Overview -->
        <div class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('cli.introTitle') }}</div>
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {{ t('cli.introDesc') }}
            </p>
        </div>

        <!-- Available Commands -->
        <div class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('cli.availableCommands') }}</div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div v-for="cmd in commands" :key="cmd.name" class="flex items-start gap-3">
                    <code
                        class="flex-shrink-0 bg-white dark:bg-gray-700 px-3 py-1 rounded text-sm font-mono cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-all"
                        @click="doCopy(cmd.name)"
                        :title="t('common.clickToCopy')"
                        >{{ cmd.name }}</code
                    >
                    <span class="text-sm text-gray-500 dark:text-gray-400 pt-0.5">{{ t(cmd.desc) }}</span>
                </div>
            </div>
        </div>

        <!-- Usage Examples -->
        <div class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('cli.examples') }}</div>
            <div class="space-y-3">
                <div>
                    <div class="text-sm text-gray-500 mb-1">{{ t('cli.versionExample') }}</div>
                    <pre
                        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all"
                        @click="doCopy('linkandroid version')"
                        :title="t('common.clickToCopy')"
                    >
$ linkandroid version
{
  "version": "1.0.0"
}</pre
                    >
                </div>
                <div>
                    <div class="text-sm text-gray-500 mb-1">{{ t('cli.devicesExample') }}</div>
                    <pre
                        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all"
                        @click="doCopy('linkandroid devices')"
                        :title="t('common.clickToCopy')"
                    >
$ linkandroid devices
{
  "devices": [
    {
      "id": "0123456789abcdef",
      "name": "Pixel 6",
      "status": "online"
    }
  ]
}</pre
                    >
                </div>
                <div>
                    <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskListExample') }}</div>
                    <pre
                        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all"
                        @click="doCopy('linkandroid task list')"
                        :title="t('common.clickToCopy')"
                    >
$ linkandroid task list
{
  "tasks": [
    {
      "id": 1,
      "name": "Seed 任务"
    }
  ]
}</pre
                    >
                </div>
                <div>
                    <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskGetExample') }}</div>
                    <pre
                        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all"
                        @click="doCopy('linkandroid task get 1')"
                        :title="t('common.clickToCopy')"
                    >
$ linkandroid task get 1
{
  "id": 1,
  "name": "Seed 任务",
  "description": "用于自动化测试的任务",
  "language": "python"
}</pre
                    >
                </div>
                <div>
                    <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskHistoryExample') }}</div>
                    <pre
                        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all"
                        @click="doCopy('linkandroid task history 1')"
                        :title="t('common.clickToCopy')"
                    >
$ linkandroid task history 1
{
  "runs": [
    {
      "id": 42,
      "status": "success"
    }
  ]
}</pre
                    >
                </div>
            </div>
        </div>

        <!-- Auth Config -->
        <div class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('cli.authTitle') }}</div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ t('cli.authDesc') }}</p>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div class="text-sm font-medium mb-2">{{ t('cli.authConfigPath') }}</div>
                <pre
                    class="bg-white dark:bg-gray-700 rounded p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all mb-3"
                    @click="doCopy(authConfigPaths.join('\n'))"
                    :title="t('common.clickToCopy')"
                ><span v-for="(line, i) in authConfigPaths" :key="i">{{ line }}<br /></span></pre>
                <div class="text-sm font-medium mb-2">{{ t('cli.authConfigContent') }}</div>
                <pre
                    class="bg-white dark:bg-gray-700 rounded p-3 text-sm font-mono overflow-x-auto cursor-pointer select-all"
                    @click="doCopy(authConfigContent)"
                    :title="t('common.clickToCopy')"
                    >{{ authConfigContent }}</pre
                >
            </div>
        </div>

        <!-- View Full Doc Button -->
        <a-button type="outline" @click="showFullDoc = true">
            <template #icon><i-lucide-book-open /></template>
            {{ t('cli.viewFullDoc') }}
        </a-button>
    </div>

    <!-- Full Documentation Modal -->
    <a-modal v-model:visible="showFullDoc" width="min(800px, 90vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ t('page.setting.cli') }}</div>
        </template>
        <div style="height: var(--modal-height-lg)">
            <div class="p-4 overflow-y-auto h-full">
                <!-- Command List -->
                <div class="mb-6">
                    <div class="text-base font-bold mb-3">{{ t('cli.availableCommands') }}</div>
                    <a-table :data="commands" :pagination="false" :bordered="false" size="small">
                        <template #columns>
                            <a-table-column title="Command" data-index="name" :width="220">
                                <template #cell="{record}">
                                    <code class="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-mono">{{
                                        record.name
                                    }}</code>
                                </template>
                            </a-table-column>
                            <a-table-column :title="t('common.value')" data-index="desc">
                                <template #cell="{record}">
                                    <span class="text-sm">{{ t(record.desc) }}</span>
                                </template>
                            </a-table-column>
                        </template>
                    </a-table>
                </div>

                <!-- Auth Doc -->
                <div class="mb-6">
                    <div class="text-base font-bold mb-3">{{ t('cli.authTitle') }}</div>
                    <p class="text-sm text-gray-500 mb-2">{{ t('cli.authDesc') }}</p>
                    <p class="text-sm text-gray-500 mb-2">{{ t('cli.fullDocAuthNote') }}</p>
                    <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto">
~/.linkandroid/client.json         ← 入口配置（dataPath）
~/.linkandroid/data/cli-auth.json  ← HTTP 认证信息</pre
                    >
                </div>

                <!-- Usage Examples (Full) -->
                <div class="mb-6">
                    <div class="text-base font-bold mb-3">{{ t('cli.examples') }}</div>
                    <div class="space-y-4">
                        <div>
                            <div class="text-sm text-gray-500 mb-1">{{ t('cli.versionExample') }}</div>
                            <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
$ linkandroid version
{
  "version": "1.0.0"
}</pre
                            >
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">{{ t('cli.devicesExample') }}</div>
                            <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
$ linkandroid devices
{
  "code": 0,
  "data": [
    {
      "id": "0123456789abcdef",
      "name": "Pixel 6",
      "status": "online"
    }
  ]
}</pre
                            >
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskListExample') }}</div>
                            <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
$ linkandroid task list
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "name": "Seed 任务",
      "description": "用于自动化测试的任务",
      "language": "python"
    }
  ]
}</pre
                            >
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskGetExample') }}</div>
                            <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
$ linkandroid task get 1
{
  "code": 0,
  "data": {
    "id": 1,
    "name": "Seed 任务",
    "description": "用于自动化测试的任务",
    "language": "python",
    "code": "print('hello')"
  }
}</pre
                            >
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskRunExample') }}</div>
                            <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
$ linkandroid task run 1
{
  "code": 0,
  "data": {
    "runId": 42,
    "log": "..."
  }
}</pre
                            >
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">{{ t('cli.taskHistoryExample') }}</div>
                            <pre class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
$ linkandroid task history 1
{
  "code": 0,
  "data": [
    {
      "id": 42,
      "task_id": 1,
      "status": "success",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}</pre
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
