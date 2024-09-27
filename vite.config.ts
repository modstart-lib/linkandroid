import fs from 'node:fs'
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'
import path from "node:path";
import {AppConfig} from "./src/config";

// https://vitejs.dev/config/
export default defineConfig(({command}) => {

    fs.rmSync('dist-electron', {recursive: true, force: true})

    const isServe = command === 'serve'
    const isBuild = command === 'build'
    const sourcemap = isServe || !!process.env.VSCODE_DEBUG
    const minify = isBuild && !process.env.VSCODE_DEBUG

    return {
        plugins: [
            vue({
                template: {
                    compilerOptions: {
                        isCustomElement: (tag) => {
                            if (['webview'].includes(tag)) {
                                return true
                            }
                            return false
                        },
                    },
                },
            }),
            {
                name: 'process-variables',
                closeBundle() {
                    const files = [
                        'splash.html', 'index.html'
                    ];
                    files.forEach(f => {
                        const p = path.resolve(__dirname, 'dist', f);
                        let html = fs.readFileSync(p, 'utf-8');
                        for (const key in AppConfig) {
                            html = html.replace(new RegExp(`%${key}%`, 'g'), AppConfig[key]);
                        }
                        fs.writeFileSync(p, html, 'utf-8');
                    })

                },
            },
            electron({
                main: {
                    // Shortcut of `build.lib.entry`
                    entry: 'electron/main/index.ts',
                    onstart({startup}) {
                        if (process.env.VSCODE_DEBUG) {
                            console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
                        } else {
                            startup()
                        }
                    },
                    vite: {
                        build: {
                            sourcemap,
                            minify: minify,
                            outDir: 'dist-electron/main',
                            rollupOptions: {
                                // Some third-party Node.js libraries may not be built correctly by Vite, especially `C/C++` addons,
                                // we can use `external` to exclude them to ensure they work correctly.
                                // Others need to put them in `dependencies` to ensure they are collected into `app.asar` after the app is built.
                                // Of course, this is not absolute, just this way is relatively simple. :)
                                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                            },
                        },
                    },
                },
                preload: {
                    // Shortcut of `build.rollupOptions.input`.
                    // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                    input: 'electron/preload/index.ts',
                    vite: {
                        build: {
                            sourcemap: sourcemap ? 'inline' : undefined, // #332
                            minify: minify,
                            outDir: 'dist-electron/preload',
                            rollupOptions: {
                                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                            },
                        },
                    },
                },
                // Ployfill the Electron and Node.js API for Renderer process.
                // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
                // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
                renderer: {},
            }),
        ],
        build: {
            sourcemap: sourcemap,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'index.html'),
                    about: path.resolve(__dirname, 'page/about.html'),
                    user: path.resolve(__dirname, 'page/user.html'),
                }
            }
        },
        server: process.env.VSCODE_DEBUG && (() => {
            const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
            return {
                host: url.hostname,
                port: +url.port,
            }
        })(),
    }
})
