<script setup lang="ts">
const { step } = defineProps<{
    step: string;
}>();
</script>
<template>
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh;">
        <h1 style="color: #fce860">loading...</h1>
        <h2>{{ step }}</h2>
    </div>
</template>