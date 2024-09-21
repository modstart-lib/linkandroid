<script setup lang="ts">
import ai from './FileExtAssets/ai.svg'
import apk from './FileExtAssets/apk.svg'
import chm from './FileExtAssets/chm.svg'
import css from './FileExtAssets/css.svg'
import doc from './FileExtAssets/doc.svg'
import docx from './FileExtAssets/docx.svg'
import dwg from './FileExtAssets/dwg.svg'
import folder from './FileExtAssets/folder.svg'
import gif from './FileExtAssets/gif.svg'
import html from './FileExtAssets/html.svg'
import jpeg from './FileExtAssets/jpeg.svg'
import jpg from './FileExtAssets/jpg.svg'
import log from './FileExtAssets/log.svg'
import mp3 from './FileExtAssets/mp3.svg'
import mp4 from './FileExtAssets/mp4.svg'
import pdf from './FileExtAssets/pdf.svg'
import png from './FileExtAssets/png.svg'
import ppt from './FileExtAssets/ppt.svg'
import pptx from './FileExtAssets/pptx.svg'
import psd from './FileExtAssets/psd.svg'
import rar from './FileExtAssets/rar.svg'
import svg from './FileExtAssets/svg.svg'
import torrent from './FileExtAssets/torrent.svg'
import txt from './FileExtAssets/txt.svg'
import unknown from './FileExtAssets/unknown.svg'
import xls from './FileExtAssets/xls.svg'
import xlsx from './FileExtAssets/xlsx.svg'
import zip from './FileExtAssets/zip.svg'
import {computed} from "vue";

const images = {
    ai,
    apk,
    chm,
    css,
    doc,
    docx,
    dwg,
    folder,
    gif,
    html,
    jpeg,
    jpg,
    log,
    mp3,
    mp4,
    pdf,
    png,
    ppt,
    pptx,
    psd,
    rar,
    svg,
    torrent,
    txt,
    unknown,
    xls,
    xlsx,
    zip
}

const props = withDefaults(defineProps<{
    isFolder?: boolean,
    name: string,
    size?: string
}>(), {
    isFolder: false,
    size: '100%'
})

const extSrc = computed(() => {
    if (props.isFolder) {
        return images['folder']
    }
    const ext = props.name.split('.').pop()?.toLowerCase()
    if (ext && images[ext]) {
        return images[ext]
    }
    return images['unknown']
})

const extSrcUrl = computed(() => {
    return `url("${extSrc.value}")`
})

</script>

<template>
    <div class="pb-file-ext"
         :style="{width: props.size, height: props.size, backgroundImage:extSrcUrl}">
    </div>
</template>

<style scoped>
.pb-file-ext {
    display: inline-block;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;

    &:after {
        content: '';
        display: block;
        padding-top: 100%;
    }
}
</style>
