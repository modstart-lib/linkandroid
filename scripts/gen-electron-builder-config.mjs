// Generate an electron-builder config that only builds for the current platform+arch.
// Usage: node scripts/gen-electron-builder-config.mjs
// Output: _temp/electron-builder-native-config.json
//
// This avoids cross-compilation — only the native arch is targeted,
// and extraResources filter includes only the matching platform directory.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// ── Read base config ──────────────────────────────────────────────
const baseConfigPath = resolve(rootDir, 'electron-builder.json5');
const baseConfig = JSON5.parse(readFileSync(baseConfigPath, 'utf-8'));

// ── Map current platform/arch to electron-builder naming ──────────
const platform = process.platform; // 'darwin' | 'win32' | 'linux'
const arch = process.arch;         // 'arm64' | 'x64'

const platformMap = {
  darwin: { name: 'mac', extraDir: 'osx' },
  win32:  { name: 'win', extraDir: 'win' },
  linux:  { name: 'linux', extraDir: 'linux' },
};

const info = platformMap[platform];
if (!info) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

// Support TARGET_ARCH env for cross-compilation (e.g. build x64 on arm64)
const targetArch = process.env.TARGET_ARCH || arch;
const archName = targetArch; // 'arm64' or 'x64'
const extraSuffix = targetArch === 'x64' ? 'x86' : 'arm64';
const extraDirGlob = `${info.extraDir}-${extraSuffix}/**`;

const buildLabel = targetArch === arch ? `${info.name}-${archName}` : `${info.name}-${archName} (native=${arch})`;
console.log(`Generating native config for ${buildLabel}`);

// ── Build native-only config ──────────────────────────────────────
const platformSection = baseConfig[info.name];
if (!platformSection) {
  console.error(`Base config missing section for platform: ${info.name}`);
  process.exit(1);
}

// Deep clone
const nativeConfig = JSON.parse(JSON.stringify(baseConfig));

// 1. Override target: only build for the current arch
const platformTarget = nativeConfig[info.name].target;
for (const t of platformTarget) {
  t.arch = [archName];
}

// 2. Override extraResources filter: include common/ + this platform's arch dir
//    electron-builder doesn't include platform-specific extra dirs (osx-arm64/ etc.)
//    via the generic filter, so we explicitly add the right one here.
nativeConfig[info.name].extraResources = [
  {
    from: 'electron/resources/extra',
    to: 'extra',
    filter: ['common', extraDirGlob],
  },
];

// ── Write output ──────────────────────────────────────────────────
const outDir = resolve(rootDir, '_temp');
mkdirSync(outDir, { recursive: true });

const outPath = resolve(outDir, 'electron-builder-native-config.json');
writeFileSync(outPath, JSON.stringify(nativeConfig, null, 2));

console.log(`Native config written to: ${outPath}`);
console.log(`  extra filter: common, ${extraDirGlob}`);
