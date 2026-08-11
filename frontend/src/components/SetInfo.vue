<script setup lang="ts">
import { type PlayerState, PlaybackState } from "@shared/types/player-state";
import { Viewport } from '../scripts/enum/Viewport';
import { socketStore } from "../scripts/socket/manager";
import { timeConverter } from '../scripts/time-converter';


const props = defineProps<{
    viewport: Viewport
    playerState?: PlayerState
}>()

function getTextWidth (text: String) {
    const widths = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2796875, 0.2765625, 0.3546875, 0.5546875, 0.5546875,
        0.8890625, 0.665625, 0.190625, 0.3328125, 0.3328125, 0.3890625, 0.5828125, 0.2765625, 0.3328125, 0.2765625, 0.3015625, 0.5546875, 0.5546875, 0.5546875,
        0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.2765625, 0.2765625, 0.584375, 0.5828125, 0.584375, 0.5546875, 1.0140625,
        0.665625, 0.665625, 0.721875, 0.721875, 0.665625, 0.609375, 0.7765625, 0.721875, 0.2765625, 0.5, 0.665625, 0.5546875, 0.8328125, 0.721875, 0.7765625,
        0.665625, 0.7765625, 0.721875, 0.665625, 0.609375, 0.721875, 0.665625, 0.94375, 0.665625, 0.665625, 0.609375, 0.2765625, 0.3546875, 0.2765625,
        0.4765625, 0.5546875, 0.3328125, 0.5546875, 0.5546875, 0.5, 0.5546875, 0.5546875, 0.2765625, 0.5546875, 0.5546875, 0.221875, 0.240625, 0.5, 0.221875,
        0.8328125, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.3328125, 0.5, 0.2765625, 0.5546875, 0.5, 0.721875, 0.5, 0.5, 0.5, 0.3546875, 0.259375,
        0.353125, 0.5890625,
    ];
    const avg = 0.5279276315789471;

    if (text) {
        return Array.from(text).reduce((acc, cur) => acc + (widths[cur.charCodeAt(0)] ?? avg), 0);
    } else {
        return 0;
    }
};

function truncateSetInfo (setInfo: string, isAuthor: boolean) {
    let maxWidth = 20;

    if (!setInfo) return setInfo;

    switch (props.viewport) {
        case Viewport.Mobile:
            maxWidth = 11;
            break;
        case Viewport.Minimized:
            maxWidth = 12;
            break;
        case Viewport.WideMinimized:
            maxWidth = 10;
            break;
        default:
            maxWidth = 20;
            break;
    }

    if (getTextWidth(setInfo) > maxWidth) {
        let truncatedString: string;
        for (let i = 0; i < setInfo.length; i++) {
            let testString = setInfo.substring(0, setInfo.length - i - 1) + "...";
            if (getTextWidth(testString) <= maxWidth * (isAuthor ? 2 : 1)) {
                truncatedString = testString;
                break;
            }
        }

        return truncatedString;
    } else {
        return setInfo;
    }
};

function getViewportFontSize (isAuthor: Boolean) {
    switch (props.viewport) {
        case Viewport.Mobile:
            return isAuthor ? 2.5 : 5;
        case Viewport.Minimized:
            return isAuthor ? 3 : 5;
        default:
            return isAuthor ? 1.5 : 3;
    }
};

function adjustSizePerSetInfo (setInfo: string, isAuthor: boolean) {
    let fullSizeThreshold = 30;

    switch (props.viewport) {
        case Viewport.Mobile:
            fullSizeThreshold = 30.75;
            break;
        case Viewport.Minimized:
            fullSizeThreshold = 35;
            break;
        case Viewport.WideMinimized:
            fullSizeThreshold = 20;
            break;
        default:
            fullSizeThreshold = 30;
            break;
    }

    return getViewportFontSize(isAuthor) * getTextWidth(setInfo) > fullSizeThreshold && props.playerState && props.playerState.state != PlaybackState.Stopped
        ? fullSizeThreshold / getTextWidth(setInfo)
        : getViewportFontSize(isAuthor);
};

const renderStreamInfoPerStatus = (
    isRunningWithData: string,
    isRunningNoData: string,
    isNotRunning: string,
    isRunningSoon: string,
    isAuthor: boolean,
    prefix: string = "",
) => {
    if (props.playerState && props.playerState.startTime != 0) {
        if (props.playerState.state == PlaybackState.Stopped && Date.now() < props.playerState.startTime) {
            let finalString: string;
            if (isRunningSoon) finalString = isRunningSoon.replace("%time%", String(timeConverter((props.playerState.startTime - Date.now()) / 1000)));
            return finalString;
        }
        return isRunningWithData ? truncateSetInfo(prefix + isRunningWithData, isAuthor) : prefix + isRunningNoData;
    } else {
        return isNotRunning;
    }
};
</script>
<template>
    <h1
        :style="{
            fontSize: `min(${getViewportFontSize(false)}vmax, ${adjustSizePerSetInfo(truncateSetInfo(socketStore.setInformation.title, false), false)}vmax)`,
        }"
    >
        {{ renderStreamInfoPerStatus(socketStore.setInformation.title, "[untitled]", "no set available", `starting in %time%`, false) }}
    </h1>
    <h2
        :style="{
            fontSize: `min(${getViewportFontSize(true)}vmax, ${adjustSizePerSetInfo(truncateSetInfo('by ' + socketStore.setInformation.author, true), true)}vmax)`,
        }"
    >
        {{ renderStreamInfoPerStatus(socketStore.setInformation.author, "[unknown author]", null, null, true, "by ") }}
    </h2>
</template>
