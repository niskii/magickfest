<script setup lang="ts">
const { step } = defineProps<{
    step: string;
}>();
</script>
<template>
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh">
        <h1 style="color: #fce860" id="loadingTitle">loading...</h1>
        <h2 id="loadingDesc">{{ step }}</h2>
    </div>
</template>
