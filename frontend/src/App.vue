<script setup lang="ts">
import Player from "./components/Player.vue";

import { onMounted } from "vue";
import { bootstrap, bootstrapDiscord } from "./bootstrap";
import ErrorScreen from "./screens/ErrorScreen.vue";
import LoadingScreen from "./screens/LoadingScreen.vue";



onMounted(() => {
    bootstrapDiscord().catch((err) => {
        bootstrap.status = 'error'
        bootstrap.error = err
    });
});
</script>

<template>
    <div id="body">
        <LoadingScreen v-if="bootstrap.status == 'loading'" :step="bootstrap.step" />

        <ErrorScreen v-else-if="bootstrap.status == 'error'" :error="bootstrap.error" />

        <Player v-else></Player>
    </div>
</template>
