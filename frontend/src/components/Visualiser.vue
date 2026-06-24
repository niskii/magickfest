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

const dpr = ref(1)
const fpsLimit = ref(60)
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const visualiser = shallowRef<Oscilloscope>(null)

const container = useTemplateRef<HTMLDivElement>('container')
const { width, height } = useElementSize(container)

const seed1 = ref(0)
const seed2 = ref(0)
const scale1 = ref(10)
const scale2 = ref(10)

function setAnalyser(analyser: AnalyserNode) {
    visualiser.value.setAnalyzer(analyser, props.fftSize)
}

const { pause, resume } = useRafFn(() => {
    if (visualiser.value !== null) {
        seed1.value = Math.floor(Math.random() * 100)
        seed2.value = Math.floor(Math.random() * 100)
        scale1.value = Math.sin(Date.now() / 3000) * 0.006 + 0.012
        scale2.value = Math.sin(Date.now() / 1000) * 0.002 + 0.0
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
    dpr.value = window.devicePixelRatio || 1
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
    /* box-sizing: content-box; */
    width: 100%;
    height: 100%;
}
</style>

<template>
    <div ref="container" id="container">
        <div id="visualiserBg"></div>
        <canvas id="canvas" ref="canvas" style="filter: url(#f1);" :width="width * dpr" :height="height * dpr"></canvas>
        <svg display="none">
            <defs>
                <filter id="f1" x="0" y="0" primitiveUnits="objectBoundingBox">
                    <!-- <feMorphology operator="dilate" radius="0.6 2.4" x="0%" y="0%" width="100%" height="100%"
                        in="SourceGraphic" result="morphology" /> -->
                    <feComponentTransfer x="0%" y="0%" width="100%" height="100%" in="SourceGraphic"
                        result="componentTransfer">
                        <feFuncR type="identity" />
                        <feFuncG type="identity" />
                        <feFuncB type="identity" />
                        <feFuncA type="table" tableValues="0 1.0" />
                    </feComponentTransfer>
                    <feTurbulence type="fractalNoise" baseFrequency="0.13 0.019" numOctaves="1" :seed=seed1
                        stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence" />
                    <feDisplacementMap in="componentTransfer" in2="turbulence" :scale=scale1 xChannelSelector="R"
                        yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap" />
                    <feTurbulence type="turbulence" baseFrequency="0.5 0.6" numOctaves="2" :seed=seed2
                        stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence1" />
                    <feComponentTransfer x="0%" y="0%" width="100%" height="100%" in="turbulence1"
                        result="componentTransfer1">
                        <feFuncR type="identity" />
                        <feFuncB type="identity" />
                        <feFuncG type="identity" />
                        <feFuncA type="discrete" tableValues="0 1 0" />
                    </feComponentTransfer>
                    <feDisplacementMap in="displacementMap" in2="componentTransfer1" :scale=scale2 xChannelSelector="A"
                        yChannelSelector="A" x="0%" y="0%" width="100%" height="100%" result="displacementMap1" />
                </filter>
            </defs>
        </svg>
    </div>
</template>