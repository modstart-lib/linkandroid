<script setup lang="ts">

</script>

<template>
    <div class="bg-gray-100 min-h-full relative">
        <iframe src="https://www.baidu.com"
                frameborder="0"
                class="absolute top-0 left-0 right-0 bottom-0 w-full h-full"></iframe>
        <div v-if="0" class="page-narrow-container p-8">
            <div class="flex">
                <div class="flex-grow bg-white rounded-lg p-8 mr-3">
                    <div class="flex">
                        <div class="w-1/2">
                            <div>当前版本</div>
                            <div class="text-3xl mt-3 font-bold">免费开源版</div>
                        </div>
                        <div class="w-1/2">
                            <div>到期时间</div>
                            <div class="text-3xl mt-3 font-bold">永久</div>
                        </div>
                    </div>
                    <div class="flex flex-wrap mt-3">
                        <div v-for="i in 4" class="w-1/2 flex-shrink-0 mt-3">
                            <icon-check-circle class="text-green-500"/>
                            版本特性
                        </div>
                    </div>
                    <div class="flex mt-4 items-center">
                        <div class="flex-grow">
                            <a href="#" class="text-link">
                                更多权益
                                <icon-double-right/>
                            </a>
                        </div>
                        <div>
                            <a-button type="primary">
                                版本升级
                            </a-button>
                        </div>
                    </div>
                </div>
                <div class="w-96 bg-white rounded-lg p-3 text-center">
                    <div class="py-10">
                        <div>
                            <img src="./../assets/image/avatar.svg"
                                 class="mx-auto p-1 w-24 h-24 rounded-full border-2 border-solid border-gray-200"/>
                        </div>
                        <div class="mt-3">
                            用户名
                        </div>
                        <div class="mt-3">
                            <a-button>账号设置</a-button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex-grow bg-white rounded-lg p-8 mt-3">
                <div class="font-bold text-lg">
                    账号信息
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
