// afterPack hook: extract CLI binary and Python environment from the
// already-packaged extra/ directory to their runtime paths (cli/ and env/task/),
// then clean up the originals from extra/ to avoid duplication.
//
// electron-builder packages electron/resources/extra/ -> Resources/extra/
// This script only moves things WITHIN the app bundle.

const common = require("./common.cjs");
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
    console.log(`  [skip] ${label}: ${src} not found`);
    return;
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

  // ── 1. Extract CLI from extra/ → cli/ ────────────────────────
  const cliFile = `linkandroid${cliSfx}`;
  const cliSrc = path.join(extraDir, cliFile);
  const cliDestDir = path.join(resRootDir, "cli");
  fs.mkdirSync(cliDestDir, {recursive: true});
  move(cliSrc, path.join(cliDestDir, cliFile), "CLI");

  // ── 2. Extract Python env + init script from extra/ → env/task/ ──
  const taskDir = path.join(resRootDir, "env", "task");
  fs.mkdirSync(taskDir, {recursive: true});

  const initScriptName = platformName === "osx" ? "init-osx.sh" : platformName === "win" ? "init-windows.sh" : "init-linux.sh";
  move(path.join(extraDir, "_aienv"), path.join(taskDir, "_aienv"), "Python _aienv");
  move(path.join(extraDir, "lib"), path.join(taskDir, "lib"), "Python lib");
  move(path.join(extraDir, initScriptName), path.join(taskDir, initScriptName), "Init script");
};
