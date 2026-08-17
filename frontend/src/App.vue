<script setup lang="ts">
import Player from "./components/Player.vue";

import { onMounted } from "vue";
import { bootstrap, bootstrapDiscord } from "./bootstrap";
import ErrorScreen from "./screens/ErrorScreen.vue";
import LoadingScreen from "./screens/LoadingScreen.vue";

onMounted(() => {
    bootstrapDiscord().catch(async (err) => {
        bootstrap.status = 'error'
        bootstrap.error = err
        await fetch("/api/auth/endsession", {
            method: "POST",
            credentials: "include",
        });
    })
});
</script>

<template>
    <div id="body" :class="[{pip: bootstrap.layout == 1}, {grid: bootstrap.layout == 2}, {desktop: bootstrap.platform == 'desktop'}, {mobile: bootstrap.platform == 'mobile'}]">
        <div id="frame">
            <LoadingScreen v-if="bootstrap.status == 'loading'" :step="bootstrap.step" />
            
            <ErrorScreen v-else-if="bootstrap.status == 'error'" :error="bootstrap.error" />
            
            <Player v-else></Player>
        </div>
    </div>
</template>
