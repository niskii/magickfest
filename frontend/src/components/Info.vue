<script setup lang="ts">
    import { usePlayer } from "../composables/Player";
    const { disconnect, connect, fetchInfo, coverImage, setInformation, isConnected } = usePlayer();
</script>

<template>
    <div id="main">
        <img src="https://picsum.photos/500" alt="cover artwork for %tmp%">
        <div>
            {{ setInformation }}
            {{ isConnected }}
            <h1>Title</h1>
            <h2>by Artist</h2>
            <h3 style="color: white;">temp shit because i havent implemented this properly yet</h3>
            <button @click="connect">connect</button>
            <button @click="disconnect">disconnect</button>
            <button @click="fetchInfo">work</button>
        </div>
    </div>
</template>