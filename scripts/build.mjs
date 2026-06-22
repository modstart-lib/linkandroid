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
import {readFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, lstatSync, readlinkSync, unlinkSync, symlinkSync, statSync} from 'node:fs';
import {resolve, dirname, join, basename, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const TEMP_DIR = '_temp';
const SHARE_REPO = 'https://github.com/modstart-lib/share-binary';
const SHARE_DIR = `${TEMP_DIR}/share-binary`;
const STANDALONE_TAG = '20260610';
const PYTHON_VERSION = '3.12.13';
const PYTHON_DEPS = ['uiautomator2', 'requests', 'pillow', 'psutil'];

const PLAT_MAP = {
  darwin: {dir: 'osx', goos: 'darwin', initScript: 'env/task/init-osx.sh'},
  win32:  {dir: 'win', goos: 'windows', initScript: 'env/task/init-windows.sh'},
  linux:  {dir: 'linux', goos: 'linux', initScript: 'env/task/init-linux.sh'},
};

function run(cmd, extraEnv = {}) {
  console.log(`  + ${cmd}`);
  try {
    execSync(cmd, {cwd: rootDir, stdio: ['inherit', 'inherit', 'pipe'], shell: true, env: {...process.env, ...extraEnv}});
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString().trim()) || '(no stderr)';
    process.stderr.write(stderr + '\n');
    throw new Error(`Command failed (exit ${e.status}): ${cmd}\n${stderr}`);
  }
}

function fail(message) {
  console.error(`  [ERROR] ${message}`);
  process.exit(1);
}

function assertPath(path, label) {
  if (!existsSync(path)) {
    fail(`${label} not found: ${path}`);
  }
  console.log(`  [check] ${label}: ${path}`);
}

function assertCommand(command, label, versionArgs = '--version') {
  try {
    execSync(`${command} ${versionArgs}`, {cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'], shell: true});
    console.log(`  [check] ${label}: ${command}`);
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString().trim()) || e.message || '(no output)';
    fail(`${label} command unavailable: ${command}\n${stderr}`);
  }
}

function formatBytes(bytes) {
  if (bytes > 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes > 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function pathSize(path) {
  if (!existsSync(path)) {
    return 0;
  }
  const stat = lstatSync(path);
  if (!stat.isDirectory()) {
    return stat.size;
  }
  let total = 0;
  walkFiles(path, (file, fileStat) => {
    if (!fileStat.isDirectory()) {
      total += fileStat.size;
    }
  });
  return total;
}

function getVersion() {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

function pythonTarget(a) {
  if (process.platform === 'darwin') {
    return a === 'x64' ? 'x86_64-apple-darwin' : 'aarch64-apple-darwin';
  }
  if (process.platform === 'linux') {
    return a === 'x64' ? 'x86_64-unknown-linux-gnu' : 'aarch64-unknown-linux-gnu';
  }
  if (process.platform === 'win32') {
    return a === 'x64' ? 'x86_64-pc-windows-msvc' : 'aarch64-pc-windows-msvc';
  }
  throw new Error(`Unsupported Python platform: ${process.platform}`);
}

function pythonArchiveNames(target) {
  const base = `cpython-${PYTHON_VERSION}+${STANDALONE_TAG}-${target}`;
  return [`${base}-install_only_stripped.tar.gz`, `${base}-install_only.tar.gz`];
}

function downloadPythonArchive(target) {
  const cacheDir = 'env/task/_cache';
  mkdirSync(cacheDir, {recursive: true});
  for (const fileName of pythonArchiveNames(target)) {
    const filePath = `${cacheDir}/${fileName}`;
    if (existsSync(filePath)) {
      console.log(`  [python] use cache ${filePath} (${formatBytes(statSync(filePath).size)})`);
      return filePath;
    }
    const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_TAG}/${fileName}`;
    try {
      console.log(`  [python] download ${url}`);
      run(`curl -fL --connect-timeout 30 --max-time 600 "${url}" -o "${filePath}"`);
      console.log(`  [python] archive ready ${filePath} (${formatBytes(statSync(filePath).size)})`);
      return filePath;
    } catch (_) {
      rmSync(filePath, {force: true});
      console.log(`  [python] skip missing ${fileName}`);
    }
  }
  throw new Error(`No portable Python archive found for target ${target}`);
}

function walkFiles(dir, callback) {
  if (!existsSync(dir)) {
    return;
  }
  for (const item of readdirSync(dir)) {
    const file = join(dir, item);
    const stat = lstatSync(file);
    callback(file, stat);
    if (stat.isDirectory() && existsSync(file)) {
      walkFiles(file, callback);
    }
  }
}

function normalizePythonRuntime(runtimeDir) {
  const absRuntimeDir = resolve(rootDir, runtimeDir);
  let changed = 0;
  walkFiles(absRuntimeDir, (file, stat) => {
    if (stat.isDirectory() && basename(file) === '__pycache__') {
      rmSync(file, {recursive: true, force: true});
      return;
    }
    if (!stat.isSymbolicLink()) {
      return;
    }
    const target = readlinkSync(file);
    if (!isAbsolute(target)) {
      return;
    }
    let targetInRuntime = target;
    const marker = `${sep}_aienv${sep}`;
    if (!target.startsWith(absRuntimeDir) && target.includes(marker)) {
      targetInRuntime = join(absRuntimeDir, target.split(marker).pop());
    }
    if (!targetInRuntime.startsWith(absRuntimeDir)) {
      return;
    }
    const relativeTarget = relative(dirname(file), targetInRuntime);
    unlinkSync(file);
    symlinkSync(relativeTarget || '.', file);
    changed++;
  });
  console.log(`  [python] normalized ${changed} symlink(s) in ${runtimeDir}`);
}

function buildPortablePython(arch, eName, isCrossX86) {
  const target = pythonTarget(arch);
  const archivePath = downloadPythonArchive(target);
  const runtimeRoot = process.platform === 'win32' ? 'env/task/_aienv/Scripts' : 'env/task/_aienv';
  const pythonPath = process.platform === 'win32'
    ? 'env/task/_aienv/Scripts/python.exe'
    : 'env/task/_aienv/bin/python';
  console.log(`  [python] target=${target}`);
  console.log(`  [python] archive=${archivePath}`);
  console.log(`  [python] extract=${runtimeRoot}`);
  console.log(`  [python] executable=${pythonPath}`);
  rmSync('env/task/_aienv', {recursive: true, force: true});
  mkdirSync(runtimeRoot, {recursive: true});
  run(`tar -xzf "${archivePath}" -C "${runtimeRoot}" --strip-components=1`);

  assertPath(pythonPath, `Portable Python executable (${eName})`);
  const py = isCrossX86 ? `arch -x86_64 "${pythonPath}"` : `"${pythonPath}"`;
  run(`${py} -m pip install --upgrade pip -q`);
  run(`${py} -m pip install ${PYTHON_DEPS.join(' ')} -q`);
  normalizePythonRuntime('env/task/_aienv');
  try {
    const pythonVersion = execSync(`${py} --version`, {cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    execSync(`${py} -c "import uiautomator2, requests, PIL, psutil"`, {cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe']});
    console.log(`  [verify] Portable Python OK (${eName}): ${pythonVersion}`);
    console.log(`  [verify] Portable Python size (${eName}): ${formatBytes(pathSize('env/task/_aienv'))}`);
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString().trim()) || e.message || '(no output)';
    console.error(`  [ERROR] Portable Python validation failed for ${eName}`);
    console.error(`  [ERROR] ${stderr}`);
    process.exit(1);
  }
}

// ---- helpers ----
const nativeArch = process.arch;
const info = PLAT_MAP[process.platform];
if (!info) { console.error(`Unsupported platform: ${process.platform}`); process.exit(1); }

// Determine which arches to build.
// primaryArch = the arch we're building FOR (for packaging).
const targetEnv = process.env.TARGET_ARCH;
const primaryArch = targetEnv || nativeArch;
if (!['x64', 'arm64'].includes(primaryArch)) {
  fail(`Unsupported TARGET_ARCH/process.arch: ${primaryArch} (expected x64 or arm64)`);
}

const arches = [primaryArch];
// On arm64 Mac, always also cross-prepare x86 resources
if (process.platform === 'darwin' && nativeArch === 'arm64' && primaryArch !== 'x64') {
  arches.push('x64');
}

function goArch(a) { return a === 'x64' ? 'amd64' : a; }
function edir(a) { return `${info.dir}-${a === 'x64' ? 'x86' : a}`; }
function cliName(a) { return `linkandroid-${info.goos}-${a}`; }
function suffix(_a) { return process.platform === 'win32' ? '.exe' : ''; }

function expectedPythonPath() {
  return process.platform === 'win32'
    ? 'env/task/_aienv/Scripts/python.exe'
    : 'env/task/_aienv/bin/python';
}

function printBuildPathPlan() {
  console.log(`\n─── Build path plan ───`);
  console.log(`  platform=${process.platform}`);
  console.log(`  nativeArch=${nativeArch}`);
  console.log(`  primaryArch=${primaryArch}`);
  console.log(`  arches=${arches.join(', ')}`);
  console.log(`  version=${version}`);
  for (const arch of arches) {
    const target = pythonTarget(arch);
    const archive = pythonArchiveNames(target)[0];
    console.log(`  [${edir(arch)}] target=${target}`);
    console.log(`  [${edir(arch)}] archive=${archive}`);
    console.log(`  [${edir(arch)}] archiveFallback=${pythonArchiveNames(target)[1]}`);
    console.log(`  [${edir(arch)}] extra=electron/resources/extra/${edir(arch)}/_aienv`);
    console.log(`  [${edir(arch)}] runtime=${expectedPythonPath()}`);
  }
}

const version = getVersion();
printBuildPathPlan();

function preflight() {
  console.log(`\n─── Preflight checks ───`);
  assertPath('package.json', 'package.json');
  assertPath('electron-builder.json5', 'electron-builder config');
  assertPath('cli', 'CLI source directory');
  assertPath('env/task/lib', 'Python task lib');
  assertPath(info.initScript, 'Platform init script');
  assertCommand('node', 'Node.js');
  assertCommand('npm', 'npm');
  assertCommand('npx', 'npx');
  assertCommand('go', 'Go', 'version');
  assertCommand('tar', 'tar');
  assertCommand('curl', 'curl');
}

function verifyExtraPayload(extraPath, arch) {
  console.log(`  [verify] extra payload (${edir(arch)}): ${extraPath}`);
  const cliSfx = suffix(arch);
  assertPath(`${extraPath}/linkandroid${cliSfx}`, `CLI payload (${edir(arch)})`);
  assertPath(`${extraPath}/_aienv`, `Python payload dir (${edir(arch)})`);
  assertPath(`${extraPath}/lib`, `Python lib payload (${edir(arch)})`);
  assertPath(`${extraPath}/${basename(info.initScript)}`, `Init script payload (${edir(arch)})`);
  assertPath(process.platform === 'win32'
    ? `${extraPath}/_aienv/Scripts/python.exe`
    : `${extraPath}/_aienv/bin/python`, `Python payload executable (${edir(arch)})`);
  console.log(`  [verify] extra payload size (${edir(arch)}): ${formatBytes(pathSize(extraPath))}`);
}

preflight();

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
  if (!existsSync(srcBase)) {
    console.log(`  [warn] share-binary dir missing, skip optional payload: ${srcBase}`);
    return;
  }
  mkdirSync(destBase, {recursive: true});
  for (const item of items) {
    const src = join(srcBase, item);
    const dest = join(destBase, item);
    if (!existsSync(src)) {
      console.log(`  [warn] optional share-binary missing: ${src}`);
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
  // Use extraEnv for GOOS/GOARCH instead of inline shell syntax,
  // which is not portable to Windows cmd.exe.
  const buildCliCmd = `cd cli && go build -ldflags="${versionArg}" -o ../dist-cli/${cliFile}${cliSfx} .`;
  run(buildCliCmd, {GOOS: info.goos, GOARCH: goa});

  // Also copy to electron/resources/extra/{plat}-{arch}/ (unified source)
  // Use plain name (linkandroid) without arch suffix; afterPack moves it to cli/
  mkdirSync(extraPath, {recursive: true});
  cpSync(`dist-cli/${cliFile}${cliSfx}`, `${extraPath}/linkandroid${cliSfx}`);

  // ---- 1b. Python env ----
  console.log(`\n─── Build Python env (${eName}) ───`);
  // x86 Python on arm64 Mac needs Rosetta (arch -x86_64) to install x86-compatible .dylib
  const isCrossX86 = (arch === 'x64' && process.platform === 'darwin' && nativeArch === 'arm64');
  buildPortablePython(arch, eName, isCrossX86);

  // Copy to electron/resources/extra/{plat}-{arch}/ (unified source)
  rmSync(`${extraPath}/_aienv`, {recursive: true, force: true});
  cpSync('env/task/_aienv', `${extraPath}/_aienv`, {recursive: true});
  normalizePythonRuntime(`${extraPath}/_aienv`);
  rmSync(`${extraPath}/lib`, {recursive: true, force: true});
  cpSync('env/task/lib', `${extraPath}/lib`, {recursive: true});
  // Copy platform init script (e.g. init-osx.sh) into extra dir so afterPack can move it to env/task/
  rmSync(`${extraPath}/${basename(info.initScript)}`, {recursive: true, force: true});
  cpSync(info.initScript, `${extraPath}/${basename(info.initScript)}`);
  verifyExtraPayload(extraPath, arch);
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
