<script setup lang="ts">
const { msg, func, btnContent, visible } = defineProps<{
  msg?: string;
  func?: () => void;
  btnContent?: string;
  visible?: boolean;
}>();
</script>

<template>
  <div class="overlay" v-show="visible">
    <h1>{{ msg }}</h1>
    <button @click="func">{{ btnContent }}</button>
  </div>
</template>
