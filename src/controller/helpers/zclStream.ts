import * as Zcl from "../../zspec/zcl";

const BRIGHTNESS_CLUSTER = Zcl.Clusters.genLevelCtrl.name;
const COLOR_CLUSTER = Zcl.Clusters.lightingColorCtrl.name;

/** Absolute level writes. Relative move/step commands are not included; dropping one changes the result. */
const STREAM_BRIGHTNESS_COMMANDS = new Set(["moveToLevel", "moveToLevelWithOnOff"]);

/** Absolute color writes. Continuous move/step/stop commands are not included. */
const STREAM_COLOR_COMMANDS = new Set([
    "moveToHue",
    "moveToSaturation",
    "moveToHueAndSaturation",
    "moveToColor",
    "moveToColorTemp",
    "enhancedMoveToHue",
    "enhancedMoveToHueAndSaturation",
]);

export function detectZclStreamType(cluster: {name: string}, command: {name: string}): Zcl.ZclStreamType | undefined {
    if (cluster.name === BRIGHTNESS_CLUSTER && STREAM_BRIGHTNESS_COMMANDS.has(command.name)) {
        return "brightness";
    }

    if (cluster.name === COLOR_CLUSTER && STREAM_COLOR_COMMANDS.has(command.name)) {
        return "color";
    }

    return undefined;
}

/** `requested === false` disables coalescing. A stream type forces it. Otherwise known absolute commands are marked. */
export function applyZclStreamType(
    frame: {streamType?: Zcl.ZclStreamType},
    cluster: {name: string},
    command: {name: string},
    requested?: Zcl.ZclStreamType | false,
): void {
    if (requested === false) {
        return;
    }

    const streamType = requested ?? detectZclStreamType(cluster, command);

    if (streamType) {
        frame.streamType = streamType;
    }
}
