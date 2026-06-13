<script setup lang="ts">
const { elements, funcs, disabledIndices, visible } = defineProps<{
    elements?: string[];
    funcs?: (() => void)[];
    disabledIndices?: number[];
    visible?: boolean;
}>();
</script>

<template>
    <div class="dropdown" v-show="visible">
        <div v-for="e, i in elements" :class="(disabledIndices.includes(e)) ? 'dropdownSelected' : null"
            @click="funcs[i]">
            {{ e }}
        </div>
    </div>
</template>

<style lang="scss" scoped></style>