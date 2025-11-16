<script setup lang="ts">
import { useRafFn } from '@vueuse/core';
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import { Oscilloscope } from "../scripts/osc/Oscilloscope";

const props = defineProps<{
    fftSize?: number
    lineColor: string
    backgroundColor: string
    lineWidth: number
    ResolutionX: string
    ResolutionY: string
}>()

let fpsLimit = 60
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const visualiser = shallowRef<Oscilloscope>(null)

function setAnalyser(analyser: AnalyserNode) {
    visualiser.value.setAnalyzer(analyser, props.fftSize)
}

const { resume, pause } = useRafFn(() => {
    if (visualiser.value !== null) {
        visualiser.value.draw()
    }
}, { fpsLimit })

defineExpose({
    resume,
    pause,
    setAnalyser
})

onMounted(() => {
    const oscilloscope = new Oscilloscope(canvas)
    visualiser.value = oscilloscope
    oscilloscope.lineColor = props.lineColor
    oscilloscope.lineWidth = props.lineWidth
    oscilloscope.backgroundColor = props.backgroundColor
    pause()
})

</script>

<template><canvas ref="canvas" :width=props.ResolutionX :height=props.ResolutionY></canvas></template>