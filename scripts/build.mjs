// Unified build script.
//   npm run build                  -> native arch
//   TARGET_ARCH=x64 npm run build  -> cross-compile x64 on arm64
//
// Flow:
//   0. Download share-binary (scrcpy/ffmpeg/ffprobe) -> _temp/share-binary/
//   1. Build Go CLI         -> dist-cli/ + electron/resources/extra/{plat}-{arch}/
//   2. Build Python env     -> env/task/ + electron/resources/extra/{plat}-{arch}/
//   3. Run vite build
//   4. Generate native electron-builder config
//   5. Run electron-builder

import {execSync} from 'node:child_process';
import {readFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync, readdirSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const TEMP_DIR = '_temp';
const SHARE_REPO = 'https://github.com/modstart-lib/share-binary';
const SHARE_DIR = `${TEMP_DIR}/share-binary`;

const PLAT_MAP = {
  darwin: {dir: 'osx', goos: 'darwin', initScript: 'env/task/init-osx.sh'},
  win32:  {dir: 'win', goos: 'windows', initScript: 'env/task/init-windows.sh'},
  linux:  {dir: 'linux', goos: 'linux', initScript: 'env/task/init-linux.sh'},
};

function run(cmd) {
  console.log(`  + ${cmd}`);
  execSync(cmd, {cwd: rootDir, stdio: 'inherit', shell: true});
}

function getVersion() {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

// ---- helpers ----
const nativeArch = process.arch;
const info = PLAT_MAP[process.platform];
if (!info) { console.error(`Unsupported platform: ${process.platform}`); process.exit(1); }

// Determine which arches to build.
// primaryArch = the arch we're building FOR (for packaging).
const targetEnv = process.env.TARGET_ARCH;
const primaryArch = targetEnv || nativeArch;

const arches = [primaryArch];
// On arm64 Mac, always also cross-prepare x86 resources
if (process.platform === 'darwin' && nativeArch === 'arm64' && primaryArch !== 'x64') {
  arches.push('x64');
}

function goArch(a) { return a === 'x64' ? 'amd64' : a; }
function edir(a) { return `${info.dir}-${a === 'x64' ? 'x86' : a}`; }
function cliName(a) { return `linkandroid-${info.goos}-${a}`; }
function suffix(a) { return a === 'x64' || a === 'arm64' ? '' : '.exe'; }

const version = getVersion();

// ================================================================
// 0. Download share-binary binaries (scrcpy, ffmpeg, ffprobe)
// ================================================================
console.log(`\n─── Download share-binary binaries ───`);
const shareRepoDir = join(rootDir, SHARE_DIR);
if (!existsSync(shareRepoDir)) {
  mkdirSync(TEMP_DIR, {recursive: true});
  run(`git clone --depth 1 "${SHARE_REPO}" "${SHARE_DIR}"`);
} else {
  // If already cloned, trust existing — no need to pull every time
  console.log(`  [skip] ${SHARE_DIR} already exists`);
}

// Define which files to copy per platform directory
const SHARE_FILES = {
  'osx-arm64': ['scrcpy', 'ffmpeg', 'ffprobe'],
  'osx-x86':   ['scrcpy'],
  'linux-arm64': ['ffmpeg', 'ffprobe'],
  'linux-x86':   ['scrcpy', 'ffmpeg', 'ffprobe'],
  'win-x86':     ['scrcpy', 'ffmpeg.exe', 'ffprobe.exe'],
};

function copyToExtra(platDir, items) {
  const srcBase = join(shareRepoDir, platDir);
  const destBase = join('electron/resources/extra', platDir);
  mkdirSync(destBase, {recursive: true});
  for (const item of items) {
    const src = join(srcBase, item);
    const dest = join(destBase, item);
    if (!existsSync(src)) {
      console.log(`  [skip] ${src} not found`);
      continue;
    }
    console.log(`  [copy] ${platDir}/${item}`);
    rmSync(dest, {recursive: true, force: true});
    cpSync(src, dest, {recursive: true});
  }
}

for (const [platDir, items] of Object.entries(SHARE_FILES)) {
  copyToExtra(platDir, items);
}

// ================================================================
// 1. Build CLI & Python env for each arch
// ================================================================
for (const arch of arches) {
  const eName = edir(arch);
  const extraPath = `electron/resources/extra/${eName}`;

  // ---- 1a. CLI ----
  console.log(`\n─── Build CLI (${eName}) ───`);
  const versionArg = `-X main.Version=${version}`;
  const goa = goArch(arch);
  const cliFile = cliName(arch);
  const cliSfx = suffix(arch);

  // Build to dist-cli/ (for electron-builder packaging).
  // Go cross-compiles natively — no Rosetta needed.
  mkdirSync('dist-cli', {recursive: true});
  const buildCliCmd = `cd cli && GOOS=${info.goos} GOARCH=${goa} go build -ldflags="${versionArg}" -o ../dist-cli/${cliFile}${cliSfx} .`;
  run(buildCliCmd);

  // Also copy to electron/resources/extra/{plat}-{arch}/ (unified source)
  mkdirSync(extraPath, {recursive: true});
  cpSync(`dist-cli/${cliFile}${cliSfx}`, `${extraPath}/${cliFile}${cliSfx}`);

  // ---- 1b. Python env ----
  console.log(`\n─── Build Python env (${eName}) ───`);
  rmSync('env/task/_aienv', {recursive: true, force: true});
  // x86 Python on arm64 Mac needs Rosetta (arch -x86_64) to install x86-compatible .dylib
  const isCrossX86 = (arch === 'x64' && process.platform === 'darwin' && nativeArch === 'arm64');
  const pyCmd = isCrossX86 ? `arch -x86_64 bash ${info.initScript}` : `bash ${info.initScript}`;
  run(pyCmd);

  // Copy to electron/resources/extra/{plat}-{arch}/ (unified source)
  rmSync(`${extraPath}/_aienv`, {recursive: true, force: true});
  cpSync('env/task/_aienv', `${extraPath}/_aienv`, {recursive: true});
  rmSync(`${extraPath}/lib`, {recursive: true, force: true});
  cpSync('env/task/lib', `${extraPath}/lib`, {recursive: true});
}

// ---- Ensure primary arch's Python env is in env/task/ ----
if (primaryArch !== arches[arches.length - 1]) {
  console.log(`\n─── Restore primary Python env (${edir(primaryArch)}) ───`);
  rmSync('env/task/_aienv', {recursive: true, force: true});
  cpSync(`electron/resources/extra/${edir(primaryArch)}/_aienv`, 'env/task/_aienv', {recursive: true});
  rmSync('env/task/lib', {recursive: true, force: true});
  cpSync(`electron/resources/extra/${edir(primaryArch)}/lib`, 'env/task/lib', {recursive: true});
}

// ================================================================
// 2. Vite build
// ================================================================
console.log(`\n─── Vite build ───`);
run('cross-env VITE_RELEASE=1 npx vite build');

// ================================================================
// 3. electron-builder with native config
// ================================================================
console.log(`\n─── electron-builder ───`);
run('node scripts/gen-electron-builder-config.mjs');
run('npx electron-builder --config _temp/electron-builder-native-config.json');
