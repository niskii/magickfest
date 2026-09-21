import { Bitrate } from "@shared/types/audio-transfer";
import { ref } from "vue";

export const visualizerFFTSize = ref<number>(12);
export const visualizerFPSLimit = ref<number>(60);
export const visualizerColor = ref<string>("#E0861F");
export const visualizerWidth = ref<number>(1.5);
export const bitrate = ref(Bitrate.High);
export const volume = ref<number>(75);
export const muted = ref<boolean>(false);
export const altIcons = ref<boolean>(false);
export const visualiserOn = ref<boolean>(true);
export const easterEggStatus = ref<boolean>(false);

export function load() {
    localStorage.getItem("visualizerFFTSize")
        ? (visualizerFFTSize.value = parseInt(
              localStorage.getItem("visualizerFFTSize"),
          ))
        : null;
    localStorage.getItem("visualizerFPSLimit")
        ? (visualizerFPSLimit.value = parseInt(
              localStorage.getItem("visualizerFPSLimit"),
          ))
        : null;
    localStorage.getItem("visualizerWidth")
        ? (visualizerWidth.value = parseFloat(
              localStorage.getItem("visualizerWidth"),
          ))
        : null;
    localStorage.getItem("visualizerColor")
        ? (visualizerColor.value = localStorage.getItem("visualizerColor"))
        : null;
    localStorage.getItem("bitrate")
        ? (bitrate.value = parseInt(localStorage.getItem("bitrate")))
        : null;
    localStorage.getItem("volume")
        ? (volume.value = parseInt(localStorage.getItem("volume")))
        : null;
    localStorage.getItem("muted")
        ? (muted.value = localStorage.getItem("muted") == "true")
        : null;
    localStorage.getItem("altIcons")
        ? (altIcons.value = localStorage.getItem("altIcons") == "true")
        : null;
    localStorage.getItem("easterEggStatus")
        ? (easterEggStatus.value = localStorage.getItem("easterEggStatus") == "true")
        : null;
}
