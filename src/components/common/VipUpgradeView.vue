<script setup lang="ts">
import {onMounted} from 'vue'

defineProps({
    desc: {
        type: String,
        default: '',
    },
})


</script>

<template>
    <div class="h-full w-full flex items-center justify-center p-4 bg-slate-50">
        <div
            class="text-center py-16 px-12 bg-white rounded-xl shadow-sm border border-amber-100 max-w-md w-full transition-all hover:shadow-md"
        >
            <div class="text-center mb-8">
                <svg
                    class="mx-auto w-20 h-20"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    width="256"
                    height="256"
                >
                    <path
                        d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z"
                        fill="#FBBF24"
                    ></path>
                    <path
                        d="M512 288l80 160 176 24-128 124 32 176L512 688l-160 84 32-176L256 472l176-24z"
                        fill="#FFFFFF"
                    ></path>
                </svg>
            </div>
            <div class="text-xl font-bold text-gray-800 mb-3">
                {{ $t('vipUpgrade.title') }}
            </div>
            <p class="text-gray-500 mb-8 leading-relaxed">
                {{ desc || $t('vipUpgrade.defaultDesc') }}
            </p>
            <div>
                <a-button
                    type="primary"
                    size="large"
                    class="px-8 rounded-full"
                    status="warning"
                    @click="$mapi.user.open()"
                >
                    <icon-star />
                    <span class="ml-2">{{ $t('vipUpgrade.activateButton') }}</span>
                </a-button>
            </div>
        </div>
    </div>
</template>
