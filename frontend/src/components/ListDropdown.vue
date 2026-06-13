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
        <div class="line"></div>
        <div v-for="e, i in elements" :class="(disabledIndices.includes(e)) ? 'dropdownSelected' : null"
            @click="funcs[i]">
            {{ e }}
            <div class="horizontalLine"></div>
        </div>
        <div class="spaceFiller"></div>
    </div>
</template>

<style lang="scss" scoped></style>