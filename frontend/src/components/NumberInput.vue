<script setup lang="ts">

const props = defineProps<{
    min?: string
    max?: string
    step?: string
}>()

const model = defineModel<number>();

function decrease() {
    if (!props.min || model.value > Number(props.min))
        model.value -= parseFloat(props.step) || 1
}

function increase() {
    if (!props.max || model.value < Number(props.max))
        model.value += parseFloat(props.step) || 1
}

</script>
<style scoped>
.button {
    background-color: rgba(255, 255, 255, 0.0);
    color: #fff;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline: inherit;
}

.button:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
    /* display: none; <- Crashes Chrome on hover */
    -webkit-appearance: none;
    margin: 0;
    /* <-- Apparently some margin are still there even though it's hidden */
}

input[type=number] {
    -moz-appearance: textfield;
    background: none;
    color: #fff;
    text-align: center;
    outline: none;
    border: none;
    /* Firefox */
}
</style>

<template>
    <div>
        <button class="button" @click="decrease">-</button>
        <input type="number" v-model="model" :min="props.min" :max="props.max" :step="props.step">
        <button class="button" @click="increase">+</button>
    </div>
</template>