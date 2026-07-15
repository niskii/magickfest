<script setup lang="ts">
const props = defineProps<{
    volume: number
    muted: boolean
    alt?: boolean
}>()

const getVolumeIcon = () => {
    if (props.alt) {
        if (props.muted) {
            return "/src/assets/speaker_icons/muted.webp"
        } else if (props.volume <= 5) {
            return "/src/assets/speaker_icons/nothing.webp"
        } else if (props.volume < 35) {
            return "/src/assets/speaker_icons/low.webp"
        } else if (props.volume < 85) {
            return "/src/assets/speaker_icons/normal.webp"
        } else {
            return "/src/assets/speaker_icons/loud.webp"
        }
    } else {
        if (props.muted) {
            return "/src/assets/volume_icons/muted.webp"
        } else if (props.volume < 5) {
            return "/src/assets/volume_icons/nosound.webp"
        } else if (props.volume < 25) {
            return "/src/assets/volume_icons/quieter.webp"
        } else if (props.volume < 50) {
            return "/src/assets/volume_icons/quiet.webp"
        } else if (props.volume < 75) {
            return "/src/assets/volume_icons/kindaloud.webp"
        } else {
            return "/src/assets/volume_icons/loud.webp"
        }
    }

}
</script>

<template>
    <div style="display: flex; align-items: center; margin-top: -0.25vh;">
        <img v-show="!props.alt" style="height: 5vh;" :src="getVolumeIcon()" alt="volume icon">
        <img v-show="props.alt" style="height: 8vh; margin: 0 -0.7vw;" :src="getVolumeIcon()" alt="volume icon">
    </div>
</template>