import {exec as _exec} from "node:child_process";
import util from "node:util";
import Config from "../config/render";
import {extraResolveBin, isWin} from "../../lib/env";
import {Apps} from "../app";
import {ADB} from "../adb/render";
import {IconvUtil} from "../../lib/util";

const exec = util.promisify(_exec);

const getBinPath = async () => {
    const binPath = await Config.get("common.scrcpyPath");
    if (binPath) {
        return binPath;
    }
    return extraResolveBin('scrcpy/scrcpy')
};

const setBinPath = async (binPath: string) => {
    const binPathOld = await Config.get("common.scrcpyPath");
    if (binPath === binPathOld) {
        return false;
    }
    await Config.set("common.scrcpyPath", binPath);
    return true;
};

const shell = async (command: string) => {
    const scrcpyPath = await getBinPath();
    return await Apps.shell(`"${scrcpyPath}" ${command}`);
};

const spawnShell = async (
    args: string[],
    option: {
        stdout?: (data: string, process: any) => void;
        stderr?: (data: string, process: any) => void;
        success?: (process: any) => void;
        error?: (msg: string, exitCode: number, process: any) => void;
        cwd?: string;
        outputEncoding?: string;
        env?: Record<string, any>;
    } | null = null
) => {
    return await Apps.spawnShell([
        await getBinPath(), ...args
    ], option);
};

const mirror = async (
    serial: string,
    option: {
        title?: string;
        args?: string[];
        stdout?: (data: string, process: any) => void;
        stderr?: (data: string, process: any) => void;
        success?: (process: any) => void;
        error?: (msg: string, exitCode: number, process: any) => void;
        env?: Record<string, any>;
    }
) => {
    option = Object.assign({
        env: {},
        args: [],
    }, option);
    option.env["ADB"] = await ADB.getBinPath();
    if (isWin) {
        option.env["ADB"] = IconvUtil.convert(option.env["ADB"], "gbk");
    }
    // console.log('mirror', serial, option.args)
    return spawnShell([
        `--serial="${serial}"`,
        `--window-title="${option.title}"`,
        ...option.args,
    ], {
        stdout: option.stdout,
        stderr: option.stderr,
        success: option.success,
        error: option.error,
        env: option.env,
    });
};

export default {
    getBinPath,
    setBinPath,
    shell,
    spawnShell,
    mirror,
};
