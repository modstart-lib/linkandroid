// afterPack hook: extract CLI binary and portable Python environment from the
// already-packaged extra/ directory to their runtime paths (cli/ and env/task/),
// then clean up the originals from extra/ to avoid duplication.
//
// electron-builder packages electron/resources/extra/ -> Resources/extra/
// This script only moves things WITHIN the app bundle.

const common = require("./common.cjs");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// ── helpers ──────────────────────────────────────────────────────
function resolveApp(context, ...segments) {
  const pn = common.platformName();
  if (pn === "osx") {
    return common.pathResolve(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      "Contents",
      "Resources",
      ...segments
    );
  }
  return common.pathResolve(context.appOutDir, "resources", ...segments);
}

function move(src, dest, label) {
  if (!common.exists(src)) {
    throw new Error(`[afterPack] ${label} source not found: ${src}`);
  }
  console.log(`  [move] ${label}: ${src} -> ${dest}`);
  try { fs.rmSync(dest, {recursive: true, force: true}); } catch (_) {}
  try {
    // rename on same filesystem = instant, no permission issues
    fs.renameSync(src, dest);
  } catch (_) {
    // cross-device: copy with node.js then delete
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, {recursive: true, force: true});
    } else {
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
    try { fs.rmSync(src, {recursive: true, force: true}); } catch (__) {}
  }
}

function assertExists(file, label) {
  if (!common.exists(file)) {
    throw new Error(`[afterPack] ${label} not found: ${file}`);
  }
  console.log(`  [check] ${label}: ${file}`);
}

function dirSize(dir) {
  let total = 0;
  walkFiles(dir, (_, stat) => {
    if (!stat.isDirectory()) total += stat.size;
  });
  return total;
}

function formatBytes(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function walkFiles(dir, callback) {
  if (!common.exists(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const file = path.join(dir, item);
    const stat = fs.lstatSync(file);
    callback(file, stat);
    if (stat.isDirectory() && common.exists(file)) {
      walkFiles(file, callback);
    }
  }
}

function normalizePythonRuntime(runtimeDir) {
  const absRuntimeDir = path.resolve(runtimeDir);
  let changed = 0;
  walkFiles(absRuntimeDir, (file, stat) => {
    if (stat.isDirectory() && path.basename(file) === "__pycache__") {
      fs.rmSync(file, {recursive: true, force: true});
      return;
    }
    if (!stat.isSymbolicLink()) return;
    const target = fs.readlinkSync(file);
    if (!path.isAbsolute(target)) return;
    let targetInRuntime = target;
    const marker = `${path.sep}_aienv${path.sep}`;
    if (!target.startsWith(absRuntimeDir) && target.includes(marker)) {
      targetInRuntime = path.join(absRuntimeDir, target.split(marker).pop());
    }
    if (!targetInRuntime.startsWith(absRuntimeDir)) return;
    const relativeTarget = path.relative(path.dirname(file), targetInRuntime);
    fs.unlinkSync(file);
    fs.symlinkSync(relativeTarget || ".", file);
    changed++;
  });
  console.log(`  [normalize] Python _aienv symlink(s): ${changed}`);
}

function runOptional(cmd, args, label) {
  const result = childProcess.spawnSync(cmd, args, {stdio: "pipe", encoding: "utf8"});
  if (result.status === 0) return;
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  console.log(`  [warn] ${label} failed${output ? `: ${output}` : ""}`);
}

function prepareMacExecutable(file) {
  if (common.platformName() !== "osx") return;
  runOptional("xattr", ["-d", "com.apple.quarantine", file], "clear CLI quarantine");
  runOptional("xattr", ["-d", "com.apple.provenance", file], "clear CLI provenance");
  runOptional("codesign", ["--force", "--sign", "-", file], "codesign CLI");
}

// ── main ─────────────────────────────────────────────────────────
exports.default = async function (context) {
  console.log("BuildOptimize", {name: common.platformName(), arch: common.platformArch()});

  const platformName = common.platformName();
  const platformArch = (() => {
    const ta = process.env.TARGET_ARCH;
    if (ta) return ta === "x64" ? "x86" : ta;
    return common.platformArch();
  })();
  const name = platformName + "-" + platformArch;

  const cliSfx = platformName === "win" ? ".exe" : "";

  const extraDir = resolveApp(context, "extra", name);
  const resRootDir = resolveApp(context);
  console.log(`  [plan] extraDir=${extraDir}`);
  console.log(`  [plan] resRootDir=${resRootDir}`);
  assertExists(extraDir, "extra platform dir");

  // ── 1. Extract CLI from extra/ → cli/ ────────────────────────
  const cliFile = `linkandroid${cliSfx}`;
  const cliSrc = path.join(extraDir, cliFile);
  const cliDestDir = path.join(resRootDir, "cli");
  fs.mkdirSync(cliDestDir, {recursive: true});
  move(cliSrc, path.join(cliDestDir, cliFile), "CLI");
  const cliDest = path.join(cliDestDir, cliFile);
  prepareMacExecutable(cliDest);
  assertExists(cliDest, "CLI runtime executable");

  // ── 2. Extract portable Python env + init script from extra/ → env/task/ ──
  const taskDir = path.join(resRootDir, "env", "task");
  fs.mkdirSync(taskDir, {recursive: true});

  const initScriptName = platformName === "osx" ? "init-osx.sh" : platformName === "win" ? "init-windows.sh" : "init-linux.sh";
  const pythonDir = path.join(taskDir, "_aienv");
  move(path.join(extraDir, "_aienv"), pythonDir, "Python _aienv");
  normalizePythonRuntime(pythonDir);
  move(path.join(extraDir, "lib"), path.join(taskDir, "lib"), "Python lib");
  move(path.join(extraDir, initScriptName), path.join(taskDir, initScriptName), "Init script");
  const pythonExe = platformName === "win" ? path.join(pythonDir, "Scripts", "python.exe") : path.join(pythonDir, "bin", "python");
  assertExists(pythonExe, "Python runtime executable");
  assertExists(path.join(taskDir, "lib"), "Python runtime lib");
  assertExists(path.join(taskDir, initScriptName), "Python runtime init script");
  console.log(`  [check] Python runtime size: ${formatBytes(dirSize(pythonDir))}`);
};
