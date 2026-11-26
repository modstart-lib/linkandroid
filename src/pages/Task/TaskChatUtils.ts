export const pythonString = (value: string) => {
    return value.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")
}
