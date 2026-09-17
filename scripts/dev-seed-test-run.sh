#!/usr/bin/env bash
# Acquire an exclusive lock (stored in _temp, holding the current PID) before
# running the given test command, so concurrent test runs never overlap.
#
# Usage: bash scripts/dev-seed-test-run.sh <command> [args...]
#
# Lock behavior:
#   - Lock file lives at _temp/dev-seed-test.lock and records the holder PID.
#   - If the holder PID is still alive, the lock is respected and we wait.
#   - If the holder PID is gone (crashed/killed), the stale lock is ignored.
set -euo pipefail

LOCK_FILE="_temp/dev-seed-test.lock"
MAX_RETRIES="${LOCK_MAX_RETRIES:-10}"
RETRY_DELAY="${LOCK_RETRY_DELAY:-60}"

if [ "$#" -eq 0 ]; then
    echo "用法: bash scripts/dev-seed-test-run.sh <command> [args...]" >&2
    exit 1
fi

mkdir -p _temp

acquire_lock() {
    retries=0
    while :; do
        # Create the lock file atomically (noclobber refuses to overwrite).
        if (set -C; printf '%s\n' "$$" > "$LOCK_FILE") 2>/dev/null; then
            trap 'rm -f "$LOCK_FILE"' EXIT
            trap 'exit 130' INT TERM
            echo "已获取测试锁（PID=$$）"
            return 0
        fi

        locked_pid="$(cat "$LOCK_FILE" 2>/dev/null || true)"
        if [ -n "$locked_pid" ] && kill -0 "$locked_pid" 2>/dev/null; then
            # Holder is alive: never ignore the lock, wait for it to release.
            retries=$((retries + 1))
            if [ "$retries" -ge "$MAX_RETRIES" ]; then
                echo "等待超时（${MAX_RETRIES}次，共$((MAX_RETRIES * RETRY_DELAY / 60))分钟），其他进程 PID=${locked_pid} 仍在运行，退出" >&2
                exit 1
            fi
            echo "其他进程正在运行（PID=${locked_pid}），等待${RETRY_DELAY}秒后重试（${retries}/${MAX_RETRIES}）..."
            sleep "$RETRY_DELAY"
            continue
        fi

        # Holder is missing or already dead: ignore the stale lock and take over.
        if [ -n "$locked_pid" ]; then
            echo "检测到遗留锁（PID=${locked_pid} 已不存在），忽略锁并重新获取"
        else
            echo "检测到无主锁（未记录PID），忽略锁并重新获取"
        fi
        rm -f "$LOCK_FILE"
    done
}

acquire_lock
"$@"
