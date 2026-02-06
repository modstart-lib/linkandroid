import { extraResolveBin, extraResolveWithPlatform, isWin } from "../../lib/env";
import { ADB } from "../adb/render";
import { Apps } from "../app";
import { Log } from "../log";

const getBinPath = async (): Promise<string> => {
    return extraResolveBin("scrcpy/scrcpy");
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
    option = Object.assign({
        env: {},
        args: [],
    }, option);
    option.env["ADB"] = await ADB.getBinPath();
    option.env['SCRCPY_FONT_PATH'] = await extraResolveWithPlatform('scrcpy/font.ttf');
    option.env['SCRCPY_SERVER_PATH'] = await extraResolveWithPlatform('scrcpy/scrcpy-server');
    if (isWin) {
        // option.env["ADB"] = IconvUtil.convert(option.env["ADB"], "gbk");
    }
    let binary = await getBinPath();
    // local debug
    // option.env["SCRCPY_SERVER_PATH"] = '/Users/mz/data/project/linkandroid/linkandroid-scrcpy/x/server/scrcpy-server';
    // binary = '/Users/mz/data/project/linkandroid/linkandroid-scrcpy/x/app/scrcpy';

    Log.info('Scrcpy.spawnShell', [
        binary, ...args
    ].join(' '))
    return await Apps.spawnShell([
        binary, ...args
    ], {
        ...option,
        shell: false,
    });
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
    const args = [
        '--serial', serial,
        '--window-title', option.title || 'LinkAndroid',
        ...option.args,
    ]
    return spawnShell(args, {
        stdout: option.stdout,
        stderr: option.stderr,
        success: option.success,
        error: option.error,
        env: option.env,
    });
};

export default {
    getBinPath,
    spawnShell,
    mirror,
};
