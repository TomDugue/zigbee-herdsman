import {describe, expect, it} from "vitest";
import {applyZclStreamType, detectZclStreamType} from "../src/controller/helpers/zclStream";
import * as Zcl from "../src/zspec/zcl";

describe("ZCL stream", () => {
    const level = Zcl.Clusters.genLevelCtrl;
    const color = Zcl.Clusters.lightingColorCtrl;

    it("detectZclStreamType marks absolute level and color commands only", () => {
        expect(detectZclStreamType(level, level.commands.moveToLevel)).toBe("brightness");
        expect(detectZclStreamType(level, level.commands.moveToLevelWithOnOff)).toBe("brightness");
        expect(detectZclStreamType(level, level.commands.move)).toBeUndefined();
        expect(detectZclStreamType(level, level.commands.step)).toBeUndefined();

        expect(detectZclStreamType(color, color.commands.moveToHue)).toBe("color");
        expect(detectZclStreamType(color, color.commands.moveToSaturation)).toBe("color");
        expect(detectZclStreamType(color, color.commands.moveToHueAndSaturation)).toBe("color");
        expect(detectZclStreamType(color, color.commands.moveToColor)).toBe("color");
        expect(detectZclStreamType(color, color.commands.moveToColorTemp)).toBe("color");
        expect(detectZclStreamType(color, color.commands.enhancedMoveToHue)).toBe("color");
        expect(detectZclStreamType(color, color.commands.enhancedMoveToHueAndSaturation)).toBe("color");
        expect(detectZclStreamType(color, color.commands.moveHue)).toBeUndefined();
        expect(detectZclStreamType(color, color.commands.stopMoveStep)).toBeUndefined();

        expect(detectZclStreamType(Zcl.Clusters.pulseWidthModulation, Zcl.Clusters.pulseWidthModulation.commands.moveToLevel)).toBeUndefined();
        expect(detectZclStreamType(Zcl.Clusters.genOnOff, Zcl.Clusters.genOnOff.commands.off)).toBeUndefined();
        expect(detectZclStreamType({name: "manuSpecificFoo"}, {name: "moveToLevel"})).toBeUndefined();
    });

    it("applyZclStreamType honors explicit stream type and opt-out", () => {
        const forced: {streamType?: Zcl.ZclStreamType} = {};
        applyZclStreamType(forced, Zcl.Clusters.genOnOff, Zcl.Clusters.genOnOff.commands.off, "color");
        expect(forced.streamType).toBe("color");

        const disabled: {streamType?: Zcl.ZclStreamType} = {};
        applyZclStreamType(disabled, level, level.commands.moveToLevel, false);
        expect(disabled.streamType).toBeUndefined();

        const detected: {streamType?: Zcl.ZclStreamType} = {};
        applyZclStreamType(detected, color, color.commands.moveToColor);
        expect(detected.streamType).toBe("color");

        const untouched: {streamType?: Zcl.ZclStreamType} = {};
        applyZclStreamType(untouched, Zcl.Clusters.genOnOff, Zcl.Clusters.genOnOff.commands.off);
        expect(untouched.streamType).toBeUndefined();
    });
});
