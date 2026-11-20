/**
 * Camera list parsing and scrcpy camera argument building.
 *
 * The camera list is printed by the scrcpy server on the device and forwarded
 * to the PC on stderr, so callers must pass the combined process output here.
 * This module is intentionally dependency-free so it can be unit tested with
 * `bun test` without booting Electron.
 */

export type CameraFacing = 'front' | 'back' | 'external' | 'unknown'

export type CameraHighSpeedMode = {
    size: string
    fps: number[]
}

export type CameraInfo = {
    id: string
    facing: CameraFacing
    activeSize: string
    fps: number[]
    zoomRange: {min: number; max: number} | null
    sizes: string[]
    highSpeed: CameraHighSpeedMode[]
}

export type CameraWindowOptions = {
    cameraId: string
    cameraSize: string
    cameraFps: string
    orientation: string
    zoom: string
    torch: boolean
    bitRate: string
    alwaysOnTop: boolean
    fullscreen: boolean
    borderless: boolean
}

const parseFacing = (value: string): CameraFacing => {
    if (value === 'front' || value === 'back' || value === 'external') {
        return value
    }
    return 'unknown'
}

const parseNumberSet = (value: string): number[] => {
    const result: number[] = []
    for (const part of value.split(',')) {
        const num = Number(part.trim())
        if (Number.isFinite(num) && num > 0 && !result.includes(num)) {
            result.push(num)
        }
    }
    return result.sort((a, b) => b - a)
}

const parseZoomRange = (value: string): {min: number; max: number} | null => {
    const matched = value.match(/^\s*([\d.]+)\s*,\s*([\d.]+)\s*$/)
    if (!matched) return null
    const min = Number(matched[1])
    const max = Number(matched[2])
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) return null
    return {min, max}
}

const CAMERA_LINE = /^\s*--camera-id=(\S+)\s*\((.*)\)\s*$/
const SIZE_LINE = /^\s*-\s+(\d+x\d+)(?:\s+\(fps=\{([^}]*)\}\))?/
const HIGH_SPEED_HEADING = /^\s*High speed capture\b/

/**
 * Parse the output of `scrcpy --list-cameras` / `--list-camera-sizes`.
 *
 * Example:
 *   List of cameras:
 *       --camera-id=0    (back, 4000x3000, fps={15, 30, 60}, zoom-range=[1, 10])
 *           - 4000x3000
 *           - 1920x1080
 *         High speed capture (--camera-high-speed):
 *           - 1920x1080 (fps={120, 240})
 *
 * Unrelated lines (warnings, the trailing `(none)` / `(access denied)`) are
 * ignored; an empty array means "no usable camera list".
 */
export const parseCameraList = (output: string): CameraInfo[] => {
    const cameras: CameraInfo[] = []
    let current: CameraInfo | null = null
    let inHighSpeed = false

    for (const line of String(output || '').split(/\r?\n/)) {
        const cameraMatched = line.match(CAMERA_LINE)
        if (cameraMatched) {
            const id = cameraMatched[1]
            const detail = cameraMatched[2]
            const facingMatched = detail.match(/^\s*([a-z]+)\s*,/i)
            const sizeMatched = detail.match(/(\d+x\d+)/)
            const fpsMatched = detail.match(/fps=\{([^}]*)\}/)
            const zoomMatched = detail.match(/zoom-range=\[([^\]]*)\]/)
            current = {
                id,
                facing: parseFacing(facingMatched ? facingMatched[1].toLowerCase() : ''),
                activeSize: sizeMatched ? sizeMatched[1] : '',
                fps: fpsMatched ? parseNumberSet(fpsMatched[1]) : [],
                zoomRange: zoomMatched ? parseZoomRange(zoomMatched[1]) : null,
                sizes: [],
                highSpeed: [],
            }
            cameras.push(current)
            inHighSpeed = false
            continue
        }
        if (!current) continue
        if (HIGH_SPEED_HEADING.test(line)) {
            inHighSpeed = true
            continue
        }
        const sizeMatched = line.match(SIZE_LINE)
        if (sizeMatched) {
            const size = sizeMatched[1]
            const fps = sizeMatched[2] ? parseNumberSet(sizeMatched[2]) : []
            if (inHighSpeed) {
                current.highSpeed.push({size, fps})
            } else if (!current.sizes.includes(size)) {
                current.sizes.push(size)
            }
        }
    }

    return cameras
}

const normalizeSize = (value: string): string => {
    const matched = String(value || '').match(/^(\d+)x(\d+)$/)
    if (!matched) return ''
    const width = Number(matched[1])
    const height = Number(matched[2])
    if (!width || !height) return ''
    return `${width}x${height}`
}

/**
 * Build the scrcpy arguments for a camera mirror window.
 *
 * Camera mode has no touch control, so only video/window options are emitted.
 * `--orientation` accepts 0/90/180/270 and flip0/flip90/flip180/flip270; the
 * default "0" is omitted because it is scrcpy's default.
 */
export const buildCameraArgs = (option: CameraWindowOptions): string[] => {
    const args: string[] = ['--video-source', 'camera']
    const cameraId = String(option.cameraId || '').trim()
    if (cameraId) {
        args.push('--camera-id', cameraId)
    }
    const cameraSize = normalizeSize(option.cameraSize)
    if (cameraSize) {
        args.push('--camera-size', cameraSize)
    }
    const cameraFps = String(option.cameraFps || '').trim()
    if (/^\d+$/.test(cameraFps) && Number(cameraFps) > 0) {
        args.push('--camera-fps', cameraFps)
    }
    const orientation = String(option.orientation || '').trim()
    if (orientation && orientation !== '0') {
        args.push('--orientation', orientation)
    }
    const zoom = String(option.zoom || '').trim()
    if (zoom && Number.isFinite(Number(zoom)) && Number(zoom) !== 1) {
        args.push('--camera-zoom', zoom)
    }
    if (option.torch) {
        args.push('--camera-torch')
    }
    const bitRate = String(option.bitRate || '').trim()
    if (bitRate) {
        args.push('--video-bit-rate', bitRate)
    }
    if (option.alwaysOnTop) {
        args.push('--always-on-top')
    }
    if (option.fullscreen) {
        args.push('--fullscreen')
    }
    if (option.borderless) {
        args.push('--window-borderless')
    }
    return args
}

export const cameraOrientationOptions = (): {value: string; labelKey: string}[] => [
    {value: '0', labelKey: 'device.cameraOrientationNormal'},
    {value: '90', labelKey: 'device.cameraOrientationLeft'},
    {value: '270', labelKey: 'device.cameraOrientationRight'},
    {value: '180', labelKey: 'device.cameraOrientationUpsideDown'},
    {value: 'flip0', labelKey: 'device.cameraOrientationFlip'},
    {value: 'flip180', labelKey: 'device.cameraOrientationFlipVertical'},
    {value: 'flip90', labelKey: 'device.cameraOrientationFlipLeft'},
    {value: 'flip270', labelKey: 'device.cameraOrientationFlipRight'},
]
