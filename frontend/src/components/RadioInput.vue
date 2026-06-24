<script setup lang="ts">
const { elements, funcs, disabledIndices } = defineProps<{
    elements?: string[];
    funcs?: ((e: Event) => void)[];
    disabledIndices?: string[];
}>();
</script>

<style scoped>
.radio {
    font-size: 3.2vmax;
    color: #d9d8e2;
    margin-bottom: 2.5vh;
}

.radioSelected {
    color: #5a5a61;
}
</style>

<template>
    <div class="radio">
        <div v-for="e, i in elements" :class="(disabledIndices.includes(e)) ? 'radioSelected' : null" @click="funcs[i]">
            {{ e }}
        </div>
    </div>
</template>