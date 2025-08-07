import {extraResolveBin} from "../../lib/env";
import {Apps} from "../app";
import FileIndex from "../file";

const getBinPath = () => {
    return extraResolveBin("ffmpeg");
};

const version = async () => {
    const controller = await Apps.spawnShell(`${getBinPath()} -version`);
    const text = await controller.result();
    const match = text.match(/ffmpeg version ([\d.]+)/);
    return match ? match[1] : "";
};

const run = async (args: string[]) => {
    if (args[0] !== getBinPath()) {
        args.unshift(getBinPath());
    }
    const controller = await Apps.spawnShell(args, {
        shell: false,
    });
    return await controller.result();
};

const runToFileOrFail = async (args: string[], format: string, label: string = "ffmpeg run error") => {
    if (args[0] !== getBinPath()) {
        args.unshift(getBinPath());
    }
    const output = await FileIndex.temp(format);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "{output}") {
            args[i] = output;
        }
    }
    await run(args);
    if (!(await FileIndex.exists(output, {isFullPath: true}))) {
        throw label;
    }
    return output;
};

const getMediaDuration = async (filePath: string, ms: boolean = false) => {
    return new Promise<number>(async (resolve, reject) => {
        let buffer = "";
        let called = false;
        const controller = await Apps.spawnShell([getBinPath(), "-i", filePath], {
            shell: false,
            stdout: (data: string) => {
                console.log("FFmpeg stdout:", data);
            },
            stderr: (data: string) => {
                buffer += data;
                const match = buffer.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
                if (match) {
                    const hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const seconds = parseFloat(match[3]);
                    const duration = hours * 3600 + minutes * 60 + seconds;
                    resolve(ms ? Math.ceil(duration * 1000) : duration);
                    controller.stop();
                    called = true;
                }
            },
            success: () => {
                if (!called) {
                    reject("Could not determine media duration");
                }
            },
            error: (msg: string, exitCode: number) => {
                if (!called) {
                    reject(`FFmpeg error (code ${exitCode}): ${msg}`);
                }
            },
        });
    });
};

const setMediaRatio = async (
    input: string,
    output: string,
    option?: {
        ratio: number;
    }
) => {
    option = Object.assign(
        {
            ratio: 1.0,
        },
        option || {}
    );
    const ext = await FileIndex.ext(input);
    if (!output) {
        output = await FileIndex.temp(ext);
    }

    const buildAtempoFilter = (ratio: number): string => {
        // atempo 只支持 0.5~2.0，超过需要多次串联
        const filters = [];
        let remain = ratio;
        while (remain > 2.0) {
            filters.push("atempo=2.0");
            remain /= 2.0;
        }
        while (remain < 0.5) {
            filters.push("atempo=0.5");
            remain /= 0.5;
        }
        filters.push(`atempo=${remain}`);
        return filters.join(",");
    };

    let args = [];
    if ("mp4" === ext) {
        args = [
            getBinPath(),
            "-i",
            input,
            "-filter_complex",
            `[0:v]setpts=${(1 / option.ratio).toFixed(6)}*PTS[v];[0:a]${buildAtempoFilter(option.ratio)}[a]`,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-preset",
            "fast",
            "-y",
            output,
        ];
    } else {
        args = [getBinPath(), "-i", input, "-filter:a", buildAtempoFilter(option.ratio), "-vn", "-y", output];
    }

    // console.log("FFmpeg setMediaRatio args:", args.join(" "));

    return new Promise<string>(async (resolve, reject) => {
        let buffer = "";
        let called = false;
        const endCheck = async () => {
            if (await FileIndex.exists(output, {isFullPath: true})) {
                resolve(output);
            } else {
                reject("Failed to create output file");
            }
        };
        const controller = await Apps.spawnShell(args, {
            shell: false,
            stdout: (data: string) => {
                // console.log("FFmpeg stdout:", data);
            },
            stderr: (data: string) => {
                // console.log("FFmpeg stderr:", data);
            },
            success: () => {
                endCheck().then();
            },
            error: (msg: string, exitCode: number) => {
                endCheck().then();
            },
        });
    });
};

const convertAudio = async (
    input: string,
    output: string,
    option?: {
        channels?: number;
        sampleRate?: number;
        format?: string;
    }
) => {
    option = Object.assign(
        {
            channels: 1,
            sampleRate: 44100,
            format: "wav",
        },
        option || {}
    );
    if (!output) {
        output = await FileIndex.temp(option.format);
    }
    return new Promise<string>(async (resolve, reject) => {
        const args = [
            getBinPath(),
            "-i",
            input,
            "-ac",
            option.channels.toString(),
            "-ar",
            option.sampleRate.toString(),
            "-f",
            option.format,
            "-y",
            output,
        ];

        // console.log("FFmpeg convertAudio args:", args.join(" "));

        const controller = await Apps.spawnShell(args, {
            shell: false,
            stdout: (data: string) => {
                // console.log("FFmpeg stdout:", data);
            },
            stderr: (data: string) => {
                // console.log("FFmpeg stderr:", data);
            },
            success: () => {
                resolve(output);
            },
            error: (msg: string, exitCode: number) => {
                reject(`FFmpeg error (code ${exitCode}): ${msg}`);
            },
        });
    });
};

export const FfmpegIndex = {
    version,
    run,
    runToFileOrFail,
    getMediaDuration,
    setMediaRatio,
    convertAudio,
};

export default FfmpegIndex;
