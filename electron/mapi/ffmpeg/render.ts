import ffmpegPath from "ffmpeg-static";
import {Apps} from "../app";

const version = async () => {
    const controller = await Apps.spawnShell(`${ffmpegPath} -version`)
    const text = await controller.result()
    const match = text.match(/ffmpeg version ([\d.]+)/)
    return match ? match[1] : ''
}

const run = async (args: string[]) => {
    const controller = await Apps.spawnShell(`${ffmpegPath} ${args.join(' ')}`)
    return await controller.result()
}

export default {
    version,
    run,
}
