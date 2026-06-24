<script setup lang="ts">

const model = defineModel<string>();

</script>
<style scoped>
.swatch {
    position: relative;
    background-color: black;
    width: 2.25vmax;
    height: 2.25vmax;
    border: dashed 0.25vmax rgba(0, 0, 0, 0.3);
}

.swatch input[type="color"] {
    opacity: 0;
    position: absolute;
    width: 100%;
    height: 100%;
    cursor: pointer;
}

@media screen and (min-height: 401px) and (max-width: 500px) {
    .swatch {
        width: 5vmax;
        height: 5vmax;
        border: dashed 0.5vmax rgba(0, 0, 0, 0.3);
    }
}
</style>

<template>
    <div class="swatch" :style="{ 'background-color': model }">
        <input type="color" v-model="model">
    </div>
</template>