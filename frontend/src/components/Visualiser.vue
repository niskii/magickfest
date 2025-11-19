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

const seed1 = ref(0)
const seed2 = ref(0)

function setAnalyser(analyser: AnalyserNode) {
    visualiser.value.setAnalyzer(analyser, props.fftSize)
}

const { pause, resume } = useRafFn(() => {
    if (visualiser.value !== null) {
        seed1.value = Math.floor(Math.random() * 100)
        seed2.value = Math.floor(Math.random() * 100)
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
}

#canvas {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
}
</style>

<template>
<div ref="container" id="container">
    <canvas id="canvas" ref="canvas" style="filter: url(#f1);" :width="width * 2" :height="height * 2"></canvas>
    <svg display="none">
        <defs>
            <filter id="f1" x="0" y="0">
                <feTurbulence type="fractalNoise" baseFrequency="0.38 0.003" numOctaves="1" :seed=seed1
                    stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence" />
                <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="20" xChannelSelector="R"
                    yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap" />
                <feTurbulence type="turbulence" baseFrequency="0.22 0.22" numOctaves="2" :seed=seed2
                    stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence1" />
                <feComponentTransfer x="0%" y="0%" width="100%" height="100%" in="turbulence1"
                    result="componentTransfer1">
                    <feFuncR type="identity" />
                    <feFuncB type="identity" />
                    <feFuncG type="identity" />
                    <feFuncA type="discrete" tableValues="0 1" />
                </feComponentTransfer>
                <feDisplacementMap in="displacementMap" in2="componentTransfer1" scale="2" xChannelSelector="A"
                    yChannelSelector="A" x="0%" y="0%" width="100%" height="100%" result="displacementMap1" />
            </filter>
        </defs>
    </svg>
</div>
</template>