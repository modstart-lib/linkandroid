/**
 * Packaging smoke test: start the SDK host, register a provider/tool, run one tool round
 * against a local fake model, and report whether asar/worker wiring is usable.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

type SmokeResult = {
    ok: boolean
    stage: string
    node: string
    electron: string
    asar: boolean
    resourcesPath: string
    home: string
    hostCreateMs: number
    totalMs: number
    requests: number
    toolExecuted: boolean
    systemLen: number
    hasCodeMode: boolean
    sessionId?: string
    sessionRowsAfterReopen?: number
    contextMessages?: number
    sessionRemoved?: boolean
    error?: string
}

const writeResult = (dataRoot: string, result: SmokeResult) => {
    fs.mkdirSync(dataRoot, {recursive: true})
    fs.writeFileSync(path.join(dataRoot, 'smoke-result.json'), JSON.stringify(result, null, 2))
}

const fakeServer = (onRequest: (requestCount: number, system: string) => void) => {
    let count = 0
    const stream = (res: any, chunks: any[]) => {
        res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive'})
        for (const chunk of chunks) res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
    }
    const server = http.createServer(async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        count++
        let system = ''
        try {
            const payload = JSON.parse(body || '{}')
            system = String(payload.messages?.[0]?.content || '')
            onRequest(count, system)
            const base = {id: `chatcmpl-${count}`, object: 'chat.completion.chunk', created: 1, model: 'fake'}
            if (count === 1) {
                stream(res, [
                    {
                        ...base,
                        choices: [
                            {
                                index: 0,
                                delta: {
                                    role: 'assistant',
                                    tool_calls: [
                                        {
                                            index: 0,
                                            id: 'call_1',
                                            type: 'function',
                                            function: {
                                                name: 'agent_probe',
                                                arguments: JSON.stringify({code: 'print("ok=1")'}),
                                            },
                                        },
                                    ],
                                },
                                finish_reason: null,
                            },
                        ],
                    },
                    {...base, choices: [{index: 0, delta: {}, finish_reason: 'tool_calls'}]},
                ])
                return
            }
            stream(res, [
                {...base, choices: [{index: 0, delta: {role: 'assistant', content: 'done'}, finish_reason: null}]},
                {...base, choices: [{index: 0, delta: {}, finish_reason: 'stop'}]},
            ])
        } catch (error) {
            res.writeHead(500, {'content-type': 'application/json'})
            res.end(JSON.stringify({error: String(error)}))
        }
    })
    return {server, count: () => count}
}

export const runSmoke = async (payload: {dataRoot: string}): Promise<SmokeResult> => {
    const startedAt = Date.now()
    const dataRoot = payload?.dataRoot || path.join(process.cwd(), 'opencode-agent-smoke')
    const currentDir = typeof __dirname === 'undefined' ? process.cwd() : __dirname
    const result: SmokeResult = {
        ok: false,
        stage: 'init',
        node: process.versions.node,
        electron: process.versions.electron,
        asar: currentDir.includes('app.asar'),
        resourcesPath: process.resourcesPath,
        home: process.env.HOME || '',
        hostCreateMs: 0,
        totalMs: 0,
        requests: 0,
        toolExecuted: false,
        systemLen: 0,
        hasCodeMode: false,
    }
    let server: any = null
    let host: any = null
    let systemSeen = ''
    let toolExecuted = false
    try {
        result.stage = 'sdk-import'
        const sdkPackage = '@opencode/sdk'
        const pluginPackage = '@opencode/plugin'
        const {OpenCode}: any = await import(sdkPackage)
        const {Plugin, Provider, Model}: any = await import(pluginPackage)

        result.stage = 'fake-provider'
        const fake = fakeServer((count, system) => {
            result.requests = count
            systemSeen = system
        })
        server = fake.server
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const port = server.address().port

        result.stage = 'plugin'
        const plugin = Plugin.define({
            id: 'linkandroid-smoke',
            async setup(ctx: any) {
                await ctx.provider.transform((editor: any) => {
                    editor.add({
                        info: {
                            ...Provider.Info.empty(Provider.ID.make('linkandroid')),
                            name: 'LinkAndroid',
                            activation: 'enabled',
                            package: '@opencode/ai/providers/openai-compatible',
                            settings: {baseURL: `http://127.0.0.1:${port}/v1`, timeout: 30000},
                            request: {settings: {}, headers: {Authorization: 'Bearer smoke'}, body: {}},
                        },
                        models: [
                            {
                                ...Model.Info.default(Provider.ID.make('linkandroid'), Model.ID.make('fake')),
                                name: 'Fake',
                            },
                        ],
                    })
                })
                await ctx.tool.transform((editor: any) => {
                    editor.add({
                        name: 'agent_probe',
                        description: 'Smoke-test tool that echoes the submitted code length.',
                        options: {codemode: false},
                        input: {type: 'object', properties: {code: {type: 'string'}}, required: ['code']},
                        execute: async (input: any) => {
                            toolExecuted = true
                            return {content: `accepted ${String(input.code || '').length}`}
                        },
                    })
                })
                await ctx.session.hook('context', (event: any) => {
                    for (const key of Object.keys(event.tools || {})) if (key !== 'agent_probe') delete event.tools[key]
                    event.system = [{type: 'text', text: 'LINKANDROID_SMOKE_PROMPT'}]
                })
            },
        })

        result.stage = 'host'
        const hostStartedAt = Date.now()
        const dbPath = path.join(dataRoot, 'db', 'agent.sqlite')
        fs.mkdirSync(path.dirname(dbPath), {recursive: true})
        host = await OpenCode.create({
            plugins: [plugin],
            database: {path: dbPath},
            models: {fetch: false, snapshot: false},
            fs: {filewatcher: false},
        })
        result.hostCreateMs = Date.now() - hostStartedAt

        result.stage = 'session'
        const sessionDir = path.join(dataRoot, 'workspace')
        fs.mkdirSync(sessionDir, {recursive: true})
        const session = await host.session.create({location: {directory: sessionDir}, title: 'smoke'})
        result.sessionId = session.id
        await host.session.switchModel({sessionID: session.id, model: {providerID: 'linkandroid', id: 'fake'}})

        result.stage = 'prompt'
        await host.session.prompt({sessionID: session.id, text: 'smoke'})
        await host.session.wait({sessionID: session.id})

        // Fixed-database persistence: the session must survive a host restart and
        // remain removable, which is the contract the business layer relies on.
        result.stage = 'persist'
        await host.close()
        host = await OpenCode.create({
            plugins: [plugin],
            database: {path: dbPath},
            models: {fetch: false, snapshot: false},
            fs: {filewatcher: false},
        })
        const listed: any = await host.session.list()
        result.sessionRowsAfterReopen = (listed?.data || []).length
        result.contextMessages = (await host.session.context({sessionID: session.id})).length
        await host.session.remove({sessionID: session.id})
        const afterRemove: any = await host.session.list()
        result.sessionRemoved = !(afterRemove?.data || []).some((item: any) => item.id === session.id)

        result.stage = 'done'
        result.ok = true
        result.toolExecuted = toolExecuted
        result.systemLen = systemSeen.length
        result.hasCodeMode = systemSeen.includes('# Code Mode')
        result.totalMs = Date.now() - startedAt
    } catch (error: any) {
        result.stage = `error:${result.stage}`
        result.error = String(error?.stack || error)
        result.totalMs = Date.now() - startedAt
    } finally {
        try {
            await host?.close()
        } catch {}
        try {
            server?.close()
        } catch {}
    }
    writeResult(dataRoot, result)
    return result
}
