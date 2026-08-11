import { PlaybackState } from "@shared/types/player-state";
import { watch, type ShallowRef } from "vue";
import { bootstrap } from "../bootstrap";
import { playerState } from "./socket/manager";
import * as storage from "./stored-references";

// TODO: refactor to somewhere else.

export default (audioStreamPlayer: ShallowRef, visualiserRef: ShallowRef) => {
    watch(
        () => bootstrap.layout,
        (layout) => {
            const body = document.body;
            switch (layout) {
                case 1: // pip
                    if (bootstrap.platform == "desktop") {
                        body.style.borderRadius = "8px";
                    } else {
                        body.style.borderRadius = "1.5em";
                    }
                    break;
                case 2: // grid
                    body.style.borderRadius = "10px";
                    break;
                default: // unhandled / focused
                    body.style.borderRadius = "0";
            }
        },
    );

    watch(storage.altIcons, () => {
        localStorage.setItem("altIcons", storage.altIcons.value.toString());
    });

    watch(storage.bitrate, () => {
        localStorage.setItem("bitrate", storage.bitrate.value.toString());

        if (audioStreamPlayer.value !== null) {
            audioStreamPlayer.value.setBitrate(Number(storage.bitrate.value));
        }
    });

    watch([storage.volume, storage.muted], () => {
        localStorage.setItem("volume", storage.volume.value.toString());
        localStorage.setItem("muted", storage.muted.value.toString());

        if (audioStreamPlayer.value !== null) {
            audioStreamPlayer.value.setVolume(
                storage.muted.value ? 0.0 : Number(storage.volume.value / 100),
            );
        }
    });

    watch(
        [
            storage.visualizerColor,
            storage.visualizerFFTSize,
            storage.visualizerFPSLimit,
            storage.visualizerWidth,
        ],
        () => {
            localStorage.setItem(
                "visualizerFFTSize",
                storage.visualizerFFTSize.value.toString(),
            );
            localStorage.setItem(
                "visualizerFPSLimit",
                storage.visualizerFPSLimit.value.toString(),
            );
            localStorage.setItem(
                "visualizerWidth",
                storage.visualizerWidth.value.toString(),
            );
            localStorage.setItem(
                "visualizerColor",
                storage.visualizerColor.value.toString(),
            );
        },
    );

    watch(storage.visualiserOn, () => {
        localStorage.setItem(
            "visualiserOn",
            storage.visualiserOn.value.toString(),
        );

        if (
            storage.visualiserOn.value &&
            playerState.value &&
            playerState.value.state == PlaybackState.Running
        ) {
            visualiserRef.value.resume();
        } else {
            visualiserRef.value.pause();
        }
    });
};
