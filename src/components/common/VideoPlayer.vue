<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import Player from "xgplayer";
import "xgplayer/dist/index.min.css";

const videoContainer = ref<HTMLDivElement | undefined>(undefined);

const props = withDefaults(
    defineProps<{
        url?: string;
        width?: string;
        height?: string;
        autoplay?: boolean;
        autoplayMuted?: boolean;
        loop?: boolean;
        controls?: boolean;
    }>(),
    {
        url: "",
        width: "100%",
        height: "100%",
        autoplay: false,
        autoplayMuted: false,
        loop: false,
        controls: true,
    }
);

let player: Player | null = null;

const initPlayer = () => {
    if (player) {
        player.destroy();
        player = null;
    }
    if (videoContainer.value && props.url) {
        let url = props.url
        if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('file:')) {
            // do nothing
        } else {
            url = 'file://' + url;
        }
        player = new Player({
            el: videoContainer.value,
            url: url,
            width: props.width,
            height: props.height,
            autoplay: props.autoplay,
            muted: props.autoplayMuted,
            loop: props.loop,
            controls: props.controls,
        });
    }
};

watch(
    () => props.url,
    newUrl => {
        initPlayer();
    }
);

onMounted(() => {
    initPlayer();
});

onBeforeUnmount(() => {
    if (player) {
        player.destroy();
    }
});
</script>

<template>
    <div ref="videoContainer" :style="{ width: props.width, height: props.height }"></div>
</template>

<style scoped></style>
