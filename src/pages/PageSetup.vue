<script setup lang="ts">
import {computed, ref} from "vue";
import {Dialog} from "../lib/dialog";

const recordActiveIndex = ref(0)
const recordActive = computed(() => {
    return records.value[recordActiveIndex.value] || null
})
const records = ref([
    {
        title: '无障碍服务',
        status: 'fail',
        desc: '系统运行需要依赖无障碍服务，请打开设置，找到无障碍服务，开启本软件的无障碍服务。',
        steps: [
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            }
        ]
    },
    {
        title: '无障碍服务',
        status: 'fail',
        desc: '系统运行需要依赖无障碍服务，请打开设置，找到无障碍服务，开启本软件的无障碍服务。',
        steps: [
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            }
        ]
    },
    {
        title: '无障碍服务',
        status: 'fail',
        desc: '系统运行需要依赖无障碍服务，请打开设置，找到无障碍服务，开启本软件的无障碍服务。',
        steps: [
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            }
        ]
    },
    {
        title: '无障碍服务',
        status: 'fail',
        desc: '系统运行需要依赖无障碍服务，请打开设置，找到无障碍服务，开启本软件的无障碍服务。',
        steps: [
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            }
        ]
    },
    {
        title: '无障碍服务',
        status: 'fail',
        desc: '系统运行需要依赖无障碍服务，请打开设置，找到无障碍服务，开启本软件的无障碍服务。',
        steps: [
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            },
            {
                title: '打开设置，升成打开设置，升成打开设置，升成打开设置，升成打开设置，升成',
                image: 'https://placehold.co/600x400'
            }
        ]
    }
])

const doCheck = () => {
    records.value[recordActiveIndex.value].status = 'success'
    Dialog.tipSuccess(`恭喜完成 ${records.value[recordActiveIndex.value].title} 设置`)
    // 自动跳转到下一个
    let hasMore = false
    for (let i = 0; i < records.value.length; i++) {
        if (records.value[i].status === 'fail') {
            recordActiveIndex.value = i
            hasMore = true
            return
        }
    }
    if (!hasMore) {
        window.$mapi.app.toast('已完成所有设置')
        window.$mapi.app.windowClose('setup')
    }
}

</script>

<template>
    <div style="height:calc(100vh - 40px);"
         class="h-full">
        <div class="h-full flex">
            <div class="w-48 flex-shrink-0 h-full overflow-auto">
                <div v-for="(r,rIndex) in records" class="p-2">
                    <div class="flex items-start p-2 rounded-lg cursor-pointer hover:bg-gray-100 border"
                         @click="recordActiveIndex=rIndex"
                         :class="rIndex===recordActiveIndex?'bg-gray-200':''">
                        <div class="mr-1 pt-3">
                            <icon-check-circle v-if="r.status==='success'" class="text-green-600 text-lg"/>
                            <icon-info-circle v-else class="text-red-600 text-lg"/>
                        </div>
                        <div>
                            <div class="text-base leading-10">{{ r.title }}</div>
                            <div class="text-xs text-gray-600">{{ r.desc }}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex-grow h-full border-l p-3 overflow-auto">
                <div v-if="recordActive">
                    <div v-for="(s,sIndex) in recordActive.steps">
                        <div class="flex items-top">
                            <a-button shape="round" size="mini" type="primary" class="mr-2">{{ sIndex + 1 }}</a-button>
                            {{ s.title }}
                        </div>
                        <div class="py-3">
                            <img :src="s.image" class="w-full rounded-lg shadow"/>
                        </div>
                    </div>
                    <div class="h-20"></div>
                    <div class="fixed bottom-0 right-0 left-48 bg-white p-3 border">
                        <div>
                            <a-button type="primary"
                                      @click="doCheck">
                                <template #icon>
                                    <icon-check/>
                                </template>
                                已完成
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
