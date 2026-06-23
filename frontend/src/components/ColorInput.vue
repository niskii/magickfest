<script setup lang="ts">

const model = defineModel<string>();

</script>
<style scoped>
.swatch {
    position: relative;
    background-color: black;
    width: 2em;
    height: 2em;
    border: dashed 0.5em rgba(0, 0, 0, 0.3);
}

.swatch input[type="color"] {
    opacity: 0;
    position: absolute;
    width: 100%;
    height: 100%;
    cursor: pointer;
}
</style>

<template>
<div class="swatch" :style="{ 'background-color': model }">
    <input type="color" v-model="model">
</div>
</template>