<template>
    <!-- <div>
        <p>Playing</p>
        <button @click="connect">connect</button>
        <button @click="disconnect">disconnect</button>
        <button @click="fetchInfo">work</button>
        <div>
            Playing: {{ playState[0].toFixed(2) }} / {{ playState[1].toFixed(2) }}
            Buffer: {{ playState[2].toFixed(2) }}
        </div>
        <form>
            <label>
                <input
                    name="low"
                    type="radio"
                    value="64"
                    v-model="bitrate"
                />
                Low
            </label>
            <label>
                <input
                    name="medium"
                    type="radio"
                    value="96"
                    v-model="bitrate"
                />
                Medium
            </label>
            <label>
                <input
                    name="high"
                    type="radio"
                    value="128"
                    v-model="bitrate"
                />
                High
            </label>
        </form>
        <img :src="coverImage" width="300px"></img>
        {{ setInformation }}
    </div> -->
</template>

<script>
    export default {
        
    }
</script>

<style lang="scss" scoped>

</style>