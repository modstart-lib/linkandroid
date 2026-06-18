<script lang="ts">
export interface ModelRecord {
    providerId: string
    providerTitle: string
    modelId: string
    modelName: string
    rate?: number
    caps?: {
        vision?: boolean
        tools?: boolean
    }
}
</script>

<script setup lang="ts">
import {useModelStore} from './store/model'
import {computed} from 'vue'
import {getModelLogo} from './models'

const props = withDefaults(
    defineProps<{
        modelValue?: string
        filter?: (model: ModelRecord) => boolean
    }>(),
    {
        modelValue: '',
    },
)

const emit = defineEmits<{
    'update:modelValue': [value: string]
}>()

const model = useModelStore()

const availableModels = computed(() => {
    const models: ModelRecord[] = []
    for (const p of model.providers) {
        if (!p.data.enabled) continue
        for (const m of p.data.models) {
            if (!m.enabled) continue
            const record: ModelRecord = {
                providerId: p.id,
                providerTitle: p.title,
                modelId: m.id,
                modelName: m.label || m.name,
                rate: m.rate,
                caps: m.caps,
            }
            if (props.filter && !props.filter(record)) continue
            models.push(record)
        }
    }
    return models
})

const localValue = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
})

const selectedProvider = computed(() => {
    if (!props.modelValue) return null
    const [providerId] = props.modelValue.split('|')
    return model.providers.find((p) => p.id === providerId) || null
})

const selectedModel = computed(() => {
    if (!props.modelValue) return null
    const [providerId, modelId] = props.modelValue.split('|')
    const provider = model.providers.find((p) => p.id === providerId)
    if (!provider) return null
    return provider.data.models.find((m) => m.id === modelId) || null
})

defineExpose({
    getInfo: () => {
        return {
            providerLogo: getModelLogo(selectedModel.value?.id || ''),
            providerTitle: selectedProvider.value?.title || '',
            modelName: selectedModel.value?.label || selectedModel.value?.name || '',
        }
    },
})
</script>

<template>
    <a-select v-model="localValue" style="min-width: 200px; width: auto" :placeholder="$t('model.select')">
        <template #label>
            <div class="flex items-center justify-between w-full" v-if="selectedProvider && selectedModel">
                <div class="flex items-center">
                    <div class="mr-1">
                        <a-avatar
                            :image-url="getModelLogo(selectedModel.id)"
                            :size="20"
                            shape="square"
                            style="border: 1px solid #ccc"
                        />
                    </div>
                    <div>{{ selectedModel.label || selectedModel.name }}</div>
                </div>
                <div class="flex items-center gap-0.5 ml-2">
                    <i-lucide-image
                        v-if="selectedModel.caps?.vision"
                        class="text-gray-400 w-3 h-3"
                        :title="$t('model.capVision')"
                    />
                    <i-lucide-wrench
                        v-if="selectedModel.caps?.tools"
                        class="text-gray-400 w-3 h-3"
                        :title="$t('model.capTools')"
                    />
                    <span v-if="selectedModel.rate != null" class="text-xs text-gray-400 ml-0.5"
                        >×{{ selectedModel.rate }}</span
                    >
                </div>
            </div>
            <div class="flex items-center" v-else>
                <div class="mr-1">
                    {{ $t('model.select') }}
                </div>
            </div>
        </template>
        <a-option v-for="p in availableModels" :value="p.providerId + '|' + p.modelId">
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center">
                    <div class="mr-1">
                        <a-avatar
                            :image-url="getModelLogo(p.modelId)"
                            :size="20"
                            shape="square"
                            style="border: 1px solid #ccc"
                        />
                    </div>
                    <div>{{ p.modelName }}</div>
                </div>
                <div class="flex items-center gap-0.5 ml-2">
                    <i-lucide-image
                        v-if="p.caps?.vision"
                        class="text-gray-400 w-3 h-3"
                        :title="$t('model.capVision')"
                    />
                    <i-lucide-wrench v-if="p.caps?.tools" class="text-gray-400 w-3 h-3" :title="$t('model.capTools')" />
                    <span v-if="p.rate != null" class="text-xs text-gray-400 ml-0.5">×{{ p.rate }}</span>
                </div>
            </div>
        </a-option>
    </a-select>
</template>
