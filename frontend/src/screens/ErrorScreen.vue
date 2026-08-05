<script setup lang="ts">
const { error } = defineProps<{
    error: string;
}>();
</script>

<template>
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh;">
        <h1 style="color: lightcoral">error</h1>
        <h2>{{ error }}</h2>
    </div>
</template>