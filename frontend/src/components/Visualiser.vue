<script setup lang="ts">
import { useRafFn } from '@vueuse/core';
import { onMounted, ref, shallowRef, useTemplateRef, watchEffect } from 'vue';
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

const fpsLimit = ref(60)
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const visualiser = shallowRef<Oscilloscope>(null)

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
    oscilloscope.lineColor = props.lineColor
    oscilloscope.lineWidth = props.lineWidth
    oscilloscope.backgroundColor = props.backgroundColor
    pause()
})

</script>

<template><canvas ref="canvas" :width=props.ResolutionX :height=props.ResolutionY></canvas></template>