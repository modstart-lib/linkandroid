/** AI chat prompt: the user talks to one or more connected Android phones. */
export type AiDeviceHint = {
    devices?: Array<{id: string; name?: string; model?: string; status?: string}>
    defaultId?: string
}

const CHAT_SYSTEM_PROMPT = [
    '你是 LinkAndroid 的手机控制助手，可以直接操作已连接的 Android 手机（一台或多台），也可以在当前电脑上读写文件、运行命令。',
    '用户要求操作手机时，先调用 device_observe 查看当前界面，再用工具逐步执行；每完成一个关键动作后再 observe 确认结果。',
    '手机工具（操作手机）：device_list（列出可操作的手机）、device_observe、device_tap、device_input、device_key、device_swipe、device_open_app、device_app_list、device_sleep、device_reconnect。',
    '电脑工具（在当前电脑执行，等同 bash 的是 shell）：read、write、edit、patch、glob、grep、shell。需要把结果保存成文件（例如桌面 CSV）、运行 python / adb 脚本或处理本地数据时使用它们。',
    '工具名只能从上面列表中选择；不要把代码行（例如 device.tap(...)、la.sleep(2)）当作工具名调用。',
    '多台手机：device_tap、device_input、device_key、device_swipe、device_open_app、device_app_list、device_observe、device_reconnect 都支持 device（手机名称或序列号，只操作指定那一台）和 devices（数组，一次在每一台上执行同一动作，逐台返回结果）。',
    '用户没有说明要控制哪台手机、而在线的手机不止一台时，先用一句话反问用户「要控制哪台，还是全部」，不要自行挑一台开始操作。',
    '用户说「全部 / 所有 / 都」时，把目标手机放进 devices 数组一次执行，并在回复里逐台说明结果。',
    '某台手机离线或操作失败时单独说明，不要用其它手机的结果代替。',
    'shell 运行在本机终端；读写文件一律用绝对路径，写入电脑桌面时使用下面给出的桌面目录。',
    '如果多次 observe 都看不到预期界面或一直显示桌面，调用 device_reconnect 重置连接后再观察。',
    '工具失败时说明失败原因并尝试替代方案，不要编造成功；不做用户没有要求的高风险操作（删除数据、支付、发送消息给他人）。',
    '操作结束后用简体中文简洁回复：完成了什么、当前结果如何、失败时下一步建议。',
    '不要输出工具名或内部思考过程，只回复用户看得懂的结论。',
].join('\n')

const deviceBlock = (hint?: AiDeviceHint) => {
    const devices = (hint?.devices || []).filter((device) => device?.id)
    if (devices.length === 0) return '=== 可操作的手机 ===\n当前没有检测到可操作的手机。'
    const lines = devices.map((device, index) => {
        const label = device.name || device.model || device.id
        const status = String(device.status || '').toLowerCase() === 'offline' ? '离线' : '在线'
        const model = device.model && device.model !== label ? `${device.model} · ` : ''
        const mark = device.id === hint?.defaultId ? '（默认）' : ''
        return `${index + 1}. ${label}（${device.id}）· ${model}${status}${mark}`
    })
    return [`=== 可操作的手机（${devices.length} 台）===`, ...lines].join('\n')
}

export const buildAiSystemPrompt = (desktopHint?: string, hint?: AiDeviceHint) =>
    [CHAT_SYSTEM_PROMPT, deviceBlock(hint), desktopHint].filter(Boolean).join('\n\n')
