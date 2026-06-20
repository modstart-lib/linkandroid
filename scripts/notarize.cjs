const {notarize} = require("@electron/notarize");
const {execSync} = require("node:child_process");
const {readdirSync, lstatSync} = require("node:fs");
const {resolve, join} = require("node:path");
const common = require('./common.cjs')

/**
 * Walk a directory recursively, yielding absolute paths.
 */
function walkDir(dir) {
  const results = [];
  if (!common.exists(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Sign every .node file inside the .app bundle using the first available
 * Developer ID certificate.  This avoids Gatekeeper errors on quarantined
 * apps for unsigned native addons (rollup, fsevents, etc.).
 */
function signNodeModules(appPath) {
  const identity = execSync(
    `security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*"\\(.*\\)"/\\1/'`,
    {encoding: "utf8"}
  ).trim();
  if (!identity) {
    console.warn("  • [WARN] No Developer ID Application certificate found, skipping .node signing");
    return;
  }
  const contents = resolve(appPath, "Contents");
  if (!common.exists(contents)) {
    console.warn("  • [WARN] .app/Contents not found, skipping .node signing");
    return;
  }
  const allFiles = walkDir(contents);
  const nodeFiles = allFiles.filter(f => f.endsWith(".node"));
  if (nodeFiles.length === 0) {
    console.log("  • No .node files found, skipping code signing");
    return;
  }
  console.log(`  • Signing ${nodeFiles.length} .node file(s) with identity: ${identity}`);
  for (const file of nodeFiles) {
    try {
      execSync(
        `codesign --sign "${identity}" --force --options runtime --timestamp "${file}" 2>&1`,
        {stdio: ["ignore", "pipe", "pipe"], timeout: 30000}
      );
      console.log(`    ✓ ${file}`);
    } catch (err) {
      console.warn(`    ⚠ Failed to sign ${file}: ${err.stderr || err.message}`);
    }
  }
}

exports.default = async function notarizing(context) {
    const appName = context.packager.appInfo.productFilename;
    const {electronPlatformName, appOutDir} = context;
    console.log(`  • Notarization Start`);
    // We skip notarization if the process is not running on MacOS and
    // if the enviroment variable SKIP_NOTARIZE is set to `true`
    // This is useful for local testing where notarization is useless
    if (
        electronPlatformName !== "darwin" ||
        process.env.SKIP_NOTARIZE === "true"
    ) {
        console.log(`  • Skipping notarization`);
        return;
    }

    // THIS MUST BE THE SAME AS THE `appId` property
    // in your electron builder configuration
    const appId = "LinkAndroid";

    let appPath = `${appOutDir}/${appName}.app`;

    // ── Sign all .node files before notarization ───────────────────
    signNodeModules(appPath);

    let {APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID} = process.env;
    if (!APPLE_ID) {
        console.info("  • Notarization ignore: APPLE_ID is empty");
        await common.calcSha256()
        return;
    }
    const notarizeOption = {
        tool: "notarytool",
        appBundleId: appId,
        appPath,
        appleId: APPLE_ID,
        appleIdPassword: APPLE_ID_PASSWORD,
        teamId: APPLE_TEAM_ID,
        verbose: true,
    }
    console.log(`  • Notarizing`, `appPath:${appPath} notarizeOption:${JSON.stringify(notarizeOption)}`);
    try {
        const result = await notarize(notarizeOption);
        console.log("  • Notarization successful!");
        await common.calcSha256()
        return result;
    } catch (error) {
        console.error("  • Notarization failed:", error.message);
        console.error("  • Stack trace:", error.stack);
        await common.calcSha256()
        throw new Error(`Notarization failed: ${error.message}`);
    }

};
