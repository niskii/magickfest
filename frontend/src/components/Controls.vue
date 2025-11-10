<script setup lang="ts">
    import { ref } from "vue";
    import { usePlayer } from "../composables/Player"
    const { playState } = usePlayer();

    const volume = ref<Number>(75);

    // function moveDraggable(e: MouseEvent) {
    //     const baseX = volumeSlider.getBoundingClientRect();

    //     if (state) {
    //         let calc = e.clientX - baseX.x;
    //         if (calc >= 0 && e.clientX <= baseX.x + baseX.width) {
    //             draggable.style.left = calc + 'px';
    //             volume.value = Math.round((calc / baseX.width) * 100);
    //             console.log(volume);
    //         }
    //     }
    // }
</script>

<template>
    <div id="bottomBar">
        <div style="width: 20%" class="fullOnly">
            <img src="../assets/volume_icon.png" alt="volume icon"
                style="height: 5vh; width: 4.5vh; filter: invert() opacity(0.8);">
            <div id="volumeSlider">
                <div id="draggable" style="left: 75%"></div>
            </div>
        </div>
        <div style="width: 60%; flex-direction: column;" class="alwaysVisible">
            {{ playState[0] }} / {{ playState[1] }}
            <div id="progressbar">
                <div id="filled" style="width: 31%"></div>
            </div>
        </div>
        <div style="width: 20%; font-size: 1.65vmax;" class="fullOnly">
            quality:
            <div id="dropdownBtn">
                <text id="dropdownBtnText">128kbps &nbsp;▴</text>
                <div id="dropdown">
                    <div class="dropdownSelected">128kbps</div>
                    <div>96kbps</div>
                    <div>64kbps</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    // const draggable = document.getElementById('draggable');
    // const volumeSlider = document.getElementById('volumeSlider');
    // let quality = '128kbps';
    // let state = false;

    // Array.from(document.getElementById('dropdown').children).forEach((el) => {
    //     el.addEventListener('click', (e) => {
    //         if (el.innerHTML != quality) {
    //             quality = el.innerHTML;
    //             document.getElementsByClassName('dropdownSelected')[0].classList.remove('dropdownSelected');
    //             el.classList.add('dropdownSelected');
    //             document.getElementById('dropdownBtnText').innerHTML = quality + ' \t▴';
    //         }
    //     })
    // })

    // draggable.addEventListener('mousedown', (e) => {
    //     state = true;
    // })

    // window.addEventListener('mouseup', (e) => {
    //     state = false;
    // })

    // window.addEventListener('mousemove', (e) => {
    //     moveDraggable(e);
    // })
</script>