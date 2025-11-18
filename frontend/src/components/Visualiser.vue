<script setup lang="ts">
import { useElementSize, useRafFn } from '@vueuse/core';
import { onMounted, ref, shallowRef, useTemplateRef, watchEffect } from 'vue';
import { Oscilloscope } from "../scripts/osc/Oscilloscope";

const props = defineProps<{
    fftSize?: number
    fpsLimit: number
    lineColor: string
    backgroundColor: string
    lineWidth: number
}>()

const fpsLimit = ref(60)
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const visualiser = shallowRef<Oscilloscope>(null)

const container = useTemplateRef<HTMLDivElement>('container')
const { width, height } = useElementSize(container)


function setAnalyser(analyser: AnalyserNode) {
    visualiser.value.setAnalyzer(analyser, props.fftSize)
}

const { pause, resume } = useRafFn(() => {
    if (visualiser.value !== null) {
        visualiser.value.draw()
    }
}, { fpsLimit, immediate: false })

defineExpose({
    pause,
    resume,
    setAnalyser
})

watchEffect(() => {
    if (props.fpsLimit !== undefined) {
        fpsLimit.value = props.fpsLimit
    }
    if (visualiser.value !== null) {
        if (props.lineWidth !== undefined) {
            visualiser.value.lineWidth = props.lineWidth
        }
        if (props.backgroundColor !== undefined) {
            visualiser.value.backgroundColor = props.backgroundColor
        }
        if (props.lineColor !== undefined) {
            visualiser.value.lineColor = props.lineColor
        }
        if (props.fftSize !== undefined) {
            visualiser.value.setfftSize(props.fftSize)
        }
    }
})

onMounted(() => {
    const oscilloscope = new Oscilloscope(canvas)
    visualiser.value = oscilloscope
    pause()
})

</script>

<style scoped>
#container {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    padding: 3px;
    border-radius: 1em;
    background: #636363;
    background: linear-gradient(180deg, rgb(6, 6, 6) 0%, rgb(149 147 147) 100%);
}

#gradient {
    width: 98%;
    height: 98%;
    position: absolute;
    border-radius: 1em;
    background: rgba(255, 255, 255, 2.3);
    background: linear-gradient(180deg, rgb(78 78 78 / 78%) 0%, rgb(203 203 203 / 0%) 7%, rgb(185 185 185 / 3%) 19%, rgb(255 255 255 / 10%) 40%, rgba(255, 255, 255, 0) 60%, rgba(19, 19, 19, 0.03) 84%, rgba(26, 26, 26, 0.5) 99%);
}

#canvas {
    border-radius: 1em;
    border: 1px solid #111;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
}
</style>

<template>
<div ref="container" id="container">
    <div id="gradient"></div>
    <canvas id="canvas" ref="canvas" :width="width * 2" :height="height * 2"></canvas>
</div>
</template>