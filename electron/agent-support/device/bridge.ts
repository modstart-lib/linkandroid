import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** Paths + env needed to talk to the device through the bundled Python runtime. */
export type DeviceRuntime = {
    pythonPath: string
    libPath: string
    taskDir: string
    adbPath?: string
}

export type DeviceBridge = {
    call: (code: string, timeoutMs?: number) => Promise<string>
    close: () => void
}

const BRIDGE_SCRIPT = String.raw`import contextlib
import io
import json
import os
import re
import sys
import time
import traceback

import la
import la._state as _la_state

DEFAULT_ID = str(os.environ.get("LINKANDROID_DEVICE_ID") or "").strip()


def _parse_ids():
    raw = str(os.environ.get("LINKANDROID_DEVICE_IDS") or "").strip()
    if raw.startswith("["):
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return [str(item).strip() for item in data if str(item).strip()]
        except Exception:
            pass
    return [item.strip() for item in re.split(r"[,;\n]+", raw) if item.strip()]


DEVICE_IDS = _parse_ids()


def default_id():
    return DEFAULT_ID or (DEVICE_IDS[0] if DEVICE_IDS else "127.0.0.1")


def target(device_id=None):
    """Device proxy for one phone; keeps la's global ids in sync.

    la changes only its global connection on switch, while the recovery and
    screenshot helpers read the global id, so both are set here.
    """
    device_id = str(device_id or default_id()).strip()
    proxy = la.Device(device_id)
    raw = proxy.raw()
    _la_state._device = raw
    _la_state._device_id = device_id
    return proxy


def reset(device_id=None):
    """Rebuild one phone's connection; fixes stale hierarchy dumps."""
    device_id = str(device_id or default_id()).strip()
    try:
        previous = _la_state._device
        if previous is not None:
            service = getattr(previous, "uiautomator", None)
            if service is not None:
                try:
                    service.stop()
                except Exception:
                    pass
        time.sleep(0.5)
    except Exception:
        pass
    _la_state._device = None
    _la_state._device_id = None
    return target(device_id)


def retry(callable_, times=3, interval=1.0):
    last = None
    for _ in range(times):
        try:
            return callable_()
        except Exception as error:
            last = error
            time.sleep(interval)
    raise last


def run(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, {
                "la": la,
                "json": json,
                "retry": retry,
                "reset": reset,
                "target": target,
                "default_id": default_id,
                "device_ids": DEVICE_IDS,
                "pid": default_id,
            })
        return {"out": buf.getvalue(), "err": ""}
    except Exception:
        return {"out": buf.getvalue(), "err": traceback.format_exc(limit=4)}


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
    except Exception:
        continue
    if req.get("close"):
        break
    res = run(req.get("code") or "")
    res["id"] = req.get("id")
    sys.stdout.write(json.dumps(res, ensure_ascii=False) + "\n")
    sys.stdout.flush()
`

const MAX_OUTPUT = 20000

/**
 * Long-lived Python bridge: the agent explores the real device through short
 * snippets, so we keep one interpreter alive instead of paying Python start-up
 * (and device connection) on every tool call.
 *
 * `deviceIds` lists every phone the agent may target; `deviceId` stays the
 * default one. Both are read lazily per call, so an offline default phone no
 * longer kills the whole bridge.
 */
export const createDeviceBridge = (
    runtime: DeviceRuntime,
    deviceId: string,
    workDir: string,
    deviceIds?: string[],
): DeviceBridge => {
    const targets = Array.from(
        new Set([deviceId, ...(deviceIds || [])].map((id) => String(id || '').trim()).filter(Boolean)),
    )
    const scriptPath = path.join(workDir, 'device-bridge.py')
    fs.mkdirSync(workDir, {recursive: true})
    fs.writeFileSync(scriptPath, BRIDGE_SCRIPT)

    const pending = new Map<
        number,
        {resolve: (value: string) => void; reject: (error: Error) => void; timer: NodeJS.Timeout}
    >()
    let child: ChildProcessWithoutNullStreams | null = null
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let sequence = 0
    let closed = false

    const failPending = (message: string) => {
        for (const item of pending.values()) {
            clearTimeout(item.timer)
            item.reject(new Error(message))
        }
        pending.clear()
    }

    const start = () => {
        const proc = spawn(runtime.pythonPath, ['-u', scriptPath], {
            cwd: runtime.taskDir,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONPATH: runtime.libPath,
                LINKANDROID_DEVICE_ID: deviceId,
                LINKANDROID_DEVICE_IDS: targets.join(','),
                ANDROID_DEVICE_ADDR: deviceId,
                ...(runtime.adbPath ? {LINKANDROID_ADB_PATH: runtime.adbPath} : {}),
            },
        })
        child = proc
        proc.stdout.on('data', (data: Buffer) => {
            stdoutBuffer += data.toString('utf8')
            let index = stdoutBuffer.indexOf('\n')
            while (index >= 0) {
                const line = stdoutBuffer.slice(0, index).trim()
                stdoutBuffer = stdoutBuffer.slice(index + 1)
                index = stdoutBuffer.indexOf('\n')
                if (!line) continue
                try {
                    const message = JSON.parse(line)
                    const item = pending.get(message.id)
                    if (!item) continue
                    clearTimeout(item.timer)
                    pending.delete(message.id)
                    const text = String(message.out || '') + (message.err ? `\n[工具执行异常]\n${message.err}` : '')
                    item.resolve(text.trim())
                } catch {}
            }
        })
        proc.stderr.on('data', (data: Buffer) => {
            stderrBuffer = (stderrBuffer + data.toString('utf8')).slice(-2000)
        })
        proc.on('exit', (code) => {
            if (child === proc) child = null
            const detail = stderrBuffer.trim()
            failPending(`设备工具进程已退出（code=${code}）${detail ? `：${detail}` : ''}`)
        })
        proc.on('error', (error: Error) => {
            if (child === proc) child = null
            failPending(`设备工具进程启动失败：${error.message}`)
        })
    }

    return {
        call: (code: string, timeoutMs = 25000) =>
            new Promise<string>((resolve, reject) => {
                if (closed) {
                    reject(new Error('设备工具已关闭'))
                    return
                }
                if (!child) start()
                const proc = child
                if (!proc) {
                    reject(new Error('设备工具进程不可用'))
                    return
                }
                const id = ++sequence
                const timer = setTimeout(() => {
                    pending.delete(id)
                    reject(new Error('设备操作超时'))
                }, timeoutMs)
                pending.set(id, {resolve, reject, timer})
                proc.stdin.write(JSON.stringify({id, code}) + '\n')
            }),
        close: () => {
            closed = true
            failPending('设备工具已关闭')
            const proc = child
            child = null
            if (!proc) return
            try {
                proc.stdin.write(JSON.stringify({close: true}) + '\n')
            } catch {}
            try {
                proc.kill()
            } catch {}
        },
    }
}
