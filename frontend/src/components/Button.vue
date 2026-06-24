<script setup lang="ts">
const { text, func, bgColor } = defineProps<{
    text?: string;
    func?: ((e: Event) => void);
    bgColor?: string;
}>();
</script>
<style scoped>
.button {
    display: flex;
    color: #ebeaff;
    width: 9vw;
    height: 5vh;
    text-align: center;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 0 0 0.3vmax #1a1a1a;
    transition: box-shadow 0.3s, filter 0.3s;
    font-size: 1.15vmax;
    margin: 2vh 0;
}

.button:hover {
    box-shadow: 0 0 0 0.4vmax #6f6f6f;
}

.button:active {
    box-shadow: 0 0 0 0.3vmax #afafaf;
}

@media screen and (min-height: 401px) and (max-width: 500px) {
    .button {
        width: 40vw;
        font-size: 2.25vmax;
    }
}
</style>

<template>
    <div class="button" @click="func" :style="{ 'background-color': bgColor }">
        {{ text }}
    </div>
</template>