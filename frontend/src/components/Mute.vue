<script setup lang="ts">

import muted_speaker from "/src/assets/speaker_icons/muted.webp";
import nothing_speaker from "/src/assets/speaker_icons/nothing.webp";
import low_speaker from "/src/assets/speaker_icons/low.webp";
import normal_speaker from "/src/assets/speaker_icons/normal.webp";
import loud_speaker from "/src/assets/speaker_icons/loud.webp";

import muted_volume from "/src/assets/volume_icons/muted.webp";
import nosound_volume from "/src/assets/volume_icons/nosound.webp";
import quieter_volume from "/src/assets/volume_icons/quieter.webp";
import quiet_volume from "/src/assets/volume_icons/quiet.webp";
import kindaloud_volume from "/src/assets/volume_icons/kindaloud.webp";
import loud_volume from "/src/assets/volume_icons/loud.webp";

const props = defineProps<{
    volume: number
    muted: boolean
    alt?: boolean
}>()

const getVolumeIcon = () => {
    if (props.alt) {
        if (props.muted) {
            return muted_speaker
        } else if (props.volume <= 5) {
            return nothing_speaker
        } else if (props.volume < 35) {
            return low_speaker
        } else if (props.volume < 85) {
            return normal_speaker
        } else {
            return loud_speaker
        }
    } else {
        if (props.muted) {
            return muted_volume
        } else if (props.volume < 5) {
            return nosound_volume
        } else if (props.volume < 25) {
            return quieter_volume
        } else if (props.volume < 50) {
            return quiet_volume
        } else if (props.volume < 75) {
            return kindaloud_volume
        } else {
            return loud_volume
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