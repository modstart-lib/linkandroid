export type DiffLine = {
    type: 'same' | 'add' | 'remove'
    text: string
}

export type DiffStats = {
    added: number
    removed: number
}

/** Longest-common-subsequence cap so a huge file cannot allocate an enormous table. */
const MAX_CELLS = 4_000_000

/**
 * Line-level diff for code history and preview dialogs.
 * Trims the common prefix/suffix first, then runs an LCS over the middle part.
 */
export const buildLineDiff = (oldText: string, newText: string): DiffLine[] => {
    const oldLines = String(oldText ?? '').split('\n')
    const newLines = String(newText ?? '').split('\n')
    let start = 0
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
        start++
    }
    let oldEnd = oldLines.length - 1
    let newEnd = newLines.length - 1
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--
        newEnd--
    }
    const prefix: DiffLine[] = oldLines.slice(0, start).map((text) => ({type: 'same', text}))
    const suffix: DiffLine[] = oldLines.slice(oldEnd + 1).map((text) => ({type: 'same', text}))
    const a = oldLines.slice(start, oldEnd + 1)
    const b = newLines.slice(start, newEnd + 1)
    if (a.length === 0 && b.length === 0) {
        return [...prefix, ...suffix]
    }
    if (a.length * b.length > MAX_CELLS) {
        return [
            ...prefix,
            ...a.map((text) => ({type: 'remove' as const, text})),
            ...b.map((text) => ({type: 'add' as const, text})),
            ...suffix,
        ]
    }
    const cols = b.length + 1
    // dp[i * cols + j] = LCS length of a[i:] and b[j:]
    const dp = new Uint32Array((a.length + 1) * cols)
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i * cols + j] =
                a[i] === b[j] ? dp[(i + 1) * cols + j + 1] + 1 : Math.max(dp[(i + 1) * cols + j], dp[i * cols + j + 1])
        }
    }
    const middle: DiffLine[] = []
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            middle.push({type: 'same', text: a[i]})
            i++
            j++
        } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
            middle.push({type: 'remove', text: a[i]})
            i++
        } else {
            middle.push({type: 'add', text: b[j]})
            j++
        }
    }
    while (i < a.length) {
        middle.push({type: 'remove', text: a[i]})
        i++
    }
    while (j < b.length) {
        middle.push({type: 'add', text: b[j]})
        j++
    }
    return [...prefix, ...middle, ...suffix]
}

export const diffStats = (lines: DiffLine[]): DiffStats => {
    let added = 0
    let removed = 0
    for (const line of lines) {
        if (line.type === 'add') added++
        else if (line.type === 'remove') removed++
    }
    return {added, removed}
}
