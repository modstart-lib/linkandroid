<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {t} from '../../lang'

const props = withDefaults(
    defineProps<{
        modelValue?: string
    }>(),
    {
        modelValue: '',
    },
)

const emit = defineEmits<{
    'update:modelValue': [value: string]
}>()

// --- type options ---
const typeOptions = computed(() => [
    {label: t('cron.perMonth'), value: 'perMonth'},
    {label: t('cron.perWeek'), value: 'perWeek'},
    {label: t('cron.perDay'), value: 'perDay'},
    {label: t('cron.perHour'), value: 'perHour'},
    {label: t('cron.perNDay'), value: 'perNDay'},
    {label: t('cron.perNHour'), value: 'perNHour'},
    {label: t('cron.perNMinute'), value: 'perNMinute'},
])

const weekOptions = computed(() => [
    {label: t('cron.monday'), value: 1},
    {label: t('cron.tuesday'), value: 2},
    {label: t('cron.wednesday'), value: 3},
    {label: t('cron.thursday'), value: 4},
    {label: t('cron.friday'), value: 5},
    {label: t('cron.saturday'), value: 6},
    {label: t('cron.sunday'), value: 0},
])

interface CronItem {
    type: string
    week: number
    day: number
    hour: number
    minute: number
    second: number
}

const defaultCron = (): CronItem => ({
    type: 'perDay',
    week: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
})

const cronItem = ref<CronItem>(defaultCron())

// Parse cron string to CronItem
const parseCron = (cron: string): CronItem | null => {
    const parts = cron.split(' ')
    if (parts.length !== 5) return null
    const [minute, hour, day, _month, week] = parts
    const item = defaultCron()
    if (minute.startsWith('*/')) {
        item.type = 'perNMinute'
        item.minute = Number(minute.slice(2)) || 30
        return item
    }
    item.minute = Number(minute) || 0
    if (hour === '*') {
        item.type = 'perHour'
        return item
    }
    if (hour.startsWith('*/')) {
        item.type = 'perNHour'
        item.hour = Number(hour.slice(2)) || 1
        return item
    }
    item.hour = Number(hour) || 0
    if (day.startsWith('*/')) {
        item.type = 'perNDay'
        item.day = Number(day.slice(2)) || 3
        return item
    }
    if (day !== '*') {
        item.type = 'perMonth'
        item.day = Number(day) || 1
        return item
    }
    if (week !== '*') {
        item.type = 'perWeek'
        item.week = Number(week) || 1
        return item
    }
    item.type = 'perDay'
    return item
}

// Convert CronItem to cron string
const toCron = (item: CronItem): string => {
    switch (item.type) {
        case 'perMonth':
            return [item.minute, item.hour, item.day, '*', '*'].join(' ')
        case 'perWeek':
            return [item.minute, item.hour, '*', '*', item.week].join(' ')
        case 'perNDay':
            return [item.minute, item.hour, '*/' + item.day, '*', '*'].join(' ')
        case 'perDay':
            return [item.minute, item.hour, '*', '*', '*'].join(' ')
        case 'perNHour':
            return [item.minute, '*/' + item.hour, '*', '*', '*'].join(' ')
        case 'perHour':
            return [item.minute, '*', '*', '*', '*'].join(' ')
        case 'perNMinute':
            return ['*/' + item.minute, '*', '*', '*', '*'].join(' ')
        default:
            return ''
    }
}

// Initialize from modelValue
watch(
    () => props.modelValue,
    (val) => {
        if (val) {
            const parsed = parseCron(val)
            if (parsed) {
                cronItem.value = parsed
            }
        }
    },
    {immediate: true},
)

// Emit changes
const cronDisplay = computed(() => {
    const cron = toCron(cronItem.value)
    return cron || '* * * * *'
})

watch(
    cronItem,
    () => {
        emit('update:modelValue', cronDisplay.value)
    },
    {deep: true},
)

const onTypeChange = () => {
    const item = cronItem.value
    switch (item.type) {
        case 'perMonth':
        case 'perNDay':
            item.day = item.day || 3
            item.hour = item.hour || 1
            item.minute = item.minute || 30
            break
        case 'perWeek':
            item.week = item.week || 1
            item.hour = item.hour || 1
            item.minute = item.minute || 30
            break
        case 'perDay':
        case 'perNHour':
            item.hour = item.hour || 2
            item.minute = item.minute || 30
            break
        case 'perHour':
        case 'perNMinute':
            item.minute = item.minute || 30
            break
    }
}
</script>

<template>
    <div class="flex items-center gap-2 flex-wrap">
        <a-select
            :model-value="cronItem.type"
            style="width: 8rem"
            size="small"
            @change="
                (v: string) => {
                    cronItem.type = v
                    onTypeChange()
                }
            "
        >
            <a-option v-for="opt in typeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
        </a-select>

        <a-select
            v-if="cronItem.type === 'perWeek'"
            :model-value="cronItem.week"
            style="width: 7rem"
            size="small"
            @change="
                (v: number) => {
                    cronItem.week = v
                }
            "
        >
            <a-option v-for="opt in weekOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
        </a-select>

        <a-input-number
            v-if="['perMonth', 'perNDay'].includes(cronItem.type)"
            v-model="cronItem.day"
            :min="1"
            :max="31"
            style="width: 6rem"
            size="small"
        >
            <template #suffix>{{ $t('cron.daySuffix') }}</template>
        </a-input-number>

        <a-input-number
            v-if="['perMonth', 'perWeek', 'perDay', 'perNDay', 'perNHour'].includes(cronItem.type)"
            v-model="cronItem.hour"
            :min="0"
            :max="23"
            style="width: 6rem"
            size="small"
        >
            <template #suffix>{{ $t('cron.hourSuffix') }}</template>
        </a-input-number>

        <a-input-number
            v-if="
                ['perMonth', 'perWeek', 'perDay', 'perNDay', 'perNHour', 'perHour', 'perNMinute'].includes(
                    cronItem.type,
                )
            "
            v-model="cronItem.minute"
            :min="0"
            :max="59"
            style="width: 6rem"
            size="small"
        >
            <template #suffix>{{ $t('cron.minuteSuffix') }}</template>
        </a-input-number>

        <span class="text-xs text-gray-400 font-mono ml-1">{{ cronDisplay }}</span>
    </div>
</template>
