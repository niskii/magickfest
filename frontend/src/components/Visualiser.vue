<script setup lang="ts">
import { useRafFn, type Pausable } from '@vueuse/core';
import { onMounted, shallowRef, useTemplateRef, watchEffect } from 'vue';
import { Oscilloscope } from "../scripts/osc/Oscilloscope";

const props = defineProps<{
    fftSize?: number
    fpsLimit: number
    lineColor: string
    backgroundColor: string
    lineWidth: number
    ResolutionX: string
    ResolutionY: string
}>()

const fpsLimit = 60
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const visualiser = shallowRef<Oscilloscope>(null)
let isPaused = true;

function setAnalyser(analyser: AnalyserNode) {
    visualiser.value.setAnalyzer(analyser, props.fftSize)
}

function pause() {
    visualiserUpdater.pause()
    isPaused = true;
}

function resume() {
    visualiserUpdater.resume()
    isPaused = false
}

let visualiserUpdater: Pausable
visualiserUpdater = useRafFn(() => {
    if (visualiser.value !== null) {
        visualiser.value.draw()
    }
}, { fpsLimit })
visualiserUpdater.pause()

defineExpose({
    pause,
    resume,
    setAnalyser
})

watchEffect(() => {
    if (props.fpsLimit !== undefined) {
        visualiserUpdater = useRafFn(() => {
            if (visualiser.value !== null) {
                visualiser.value.draw()
            }
        }, { fpsLimit: props.fpsLimit })
        if (isPaused)
            visualiserUpdater.pause()
        else
            visualiserUpdater.resume()
    }
})

onMounted(() => {
    const oscilloscope = new Oscilloscope(canvas)
    visualiser.value = oscilloscope
    oscilloscope.lineColor = props.lineColor
    oscilloscope.lineWidth = props.lineWidth
    oscilloscope.backgroundColor = props.backgroundColor
    visualiserUpdater.pause()
})

</script>

<template><canvas ref="canvas" :width=props.ResolutionX :height=props.ResolutionY></canvas></template>