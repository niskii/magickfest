<script setup lang="ts">
import { type PlayerState } from '@shared/types/player-state';

const props = defineProps<{
    status?: PlayerState
}>()

const getStatus = () => {
    if (!props.status) {
        return {
            text: "no stream",
            color: "gray"
        }
    }
    switch (props.status.state) {
        case 0:
            return {
                text: "not running",
                color: "darkred"
            }

        case 1:
            return {
                text: "running",
                color: "green"
            }

        case 2:
            return {
                text: "paused",
                color: "yellow"
            }

        default:
            return {
                text: "no stream",
                color: "gray"
            }
    }
}
</script>

<template>
<div class="statusIndicator" :title="getStatus().text">
    <div class="statusText" :style="{ color: getStatus().color }">{{ getStatus().text }}</div>
    <div class="status" :style="{ backgroundColor: getStatus().color }"></div>
</div>
</template>
