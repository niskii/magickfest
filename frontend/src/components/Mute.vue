<script setup lang="ts">
const props = defineProps<{
    volume: number
    muted: boolean
    alt?: boolean
}>()

const getVolumeIcon = () => {
    if (props.muted) {
        return "/src/assets/speaker icons/muted.png"
    } else if (props.volume <= 5) {
        return "/src/assets/speaker icons/nothing.png"
    } else if (props.volume < 35) {
        return "/src/assets/speaker icons/low.png"
    } else if (props.volume < 85) {
        return "/src/assets/speaker icons/normal.png"
    } else {
        return "/src/assets/speaker icons/loud.png"
    }
}
</script>

<template>
<div>
    <img v-show="!props.alt" style="height: 5vh;"
        :src="'/src/assets/volume_icon' + (props.muted ? '_muted' : '') + '.png'" alt="volume icon">
    <img v-show="props.alt" style="height: 8vh;" :src="getVolumeIcon()" alt="volume icon">
</div>
</template>