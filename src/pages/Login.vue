<script setup lang="ts">

import {AppConfig} from "../config";
import {onBeforeMount} from "vue";
import Router from "../router";

onBeforeMount(() => {
    doLogin()
})

const doLogin = () => {
    Router.push('/home')
}
</script>

<template>
    <div class="flex" style="height:calc( 100vh - 6rem );">
        <div class="w-1/2 px-10 flex flex-col h-full">
            <div class="flex items-center">
                <div class="p-4 mr-2">
                    <img class="h-10" src="/logo.svg"/>
                </div>
                <div>
                    <div class="font-bold text-lg">
                        {{ AppConfig.name }}
                    </div>
                    <div class="text-xs text-gray-400">
                        {{ AppConfig.slogan }}
                    </div>
                </div>
            </div>
            <div class="flex-grow">
                <a-carousel
                    :style="{
                      width: '100%',
                      height: '100%',
                    }"
                    :auto-play="true"
                    indicator-type="dot"
                    show-arrow="hover"
                >
                    <a-carousel-item v-for="image in [
      'https://p1-arco.byteimg.com/tos-cn-i-uwbnlip3yd/cd7a1aaea8e1c5e3d26fe2591e561798.png~tplv-uwbnlip3yd-webp.webp',
      'https://p1-arco.byteimg.com/tos-cn-i-uwbnlip3yd/6480dbc69be1b5de95010289787d64f1.png~tplv-uwbnlip3yd-webp.webp',
      'https://p1-arco.byteimg.com/tos-cn-i-uwbnlip3yd/0265a04fddbd77a19602a15d9d55d797.png~tplv-uwbnlip3yd-webp.webp',
    ]"
                    >
                        <div class="flex flex-col items-center justify-center h-full">
                            <div>
                                <img
                                    :src="image"
                                    style="width:80%;margin:0 auto;"/>
                            </div>
                            <div class="text-lg my-3">
                                简单易用
                            </div>
                            <div class="text-gray-400">
                                简单易用
                            </div>
                        </div>
                    </a-carousel-item>
                </a-carousel>
            </div>
        </div>
        <div class="w-1/2 px-10 flex flex-col justify-center">
            <div class="max-w-96 mx-auto">
                <div class="h-10"></div>
                <div class="">
                    <a class="font-bold text-lg text-primary inline-block mr-3" href="javascript:;">
                        短信登录
                    </a>
                    <a class="font-bold text-lg text-gray-400 inline-block mr-3" href="javascript:;">
                        密码登录
                    </a>
                </div>
                <div>
                    <div class="py-4">
                        <a-input placeholder="输入手机号" size="large" allow-clear/>
                    </div>
                    <div class="py-4 flex items-center">
                        <div class="flex-grow">
                            <a-input placeholder="输入验证码" size="large" allow-clear/>
                        </div>
                        <div class="w-32">
                            <a-button type="primary" size="large" class="w-full">
                                获取验证码
                            </a-button>
                        </div>
                    </div>
                    <div class="py-4 flex">
                        <div class="flex-grow">
                            <a-checkbox value="1">自动登录</a-checkbox>
                        </div>
                        <div>
                            <a href="#">收不到验证码？</a>
                        </div>
                    </div>
                    <div class="py-4">
                        <a-button @click="doLogin"
                                  type="primary" size="large" class="w-full">
                            登录/注册
                        </a-button>
                    </div>
                    <div class="py-4 text-center text-gray-400 leading-8 text-sm">
                        <div>
                            未注册手机号登录后将自动注册，登录即代表您已同意
                        </div>
                        <div>
                            <a class="text-link" href="#">《用户协议》</a>
                            <a class="text-link" href="#">《隐私政策》</a>
                        </div>
                    </div>
                    <div class="pt-4">
                        <div class="flex justify-center">
                            <div class="p-2 flex items-center cursor-pointer">
                                <icon-wechat style="color:#128d12;font-size:1.5rem;margin-right:0.5rem;"/>
                                <span>微信登录</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
:deep(.arco-carousel-indicator-wrapper) {
    background: none;

    .arco-carousel-indicator-item {
        background-color: #EEE;
    }

    .arco-carousel-indicator-item-active {
        background-color: var(--color-primary);
    }
}
</style>
