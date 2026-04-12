const common = require("./common.cjs");

// electron-builder Arch enum values
const ARCH_X64 = 1;
const ARCH_ARM64 = 3;

const archFromContext = (contextArch) => {
    switch (contextArch) {
        case ARCH_X64: return "x86";    // x64 -> x86 (matches directory naming convention)
        case ARCH_ARM64: return "arm64";
        default: return common.platformArch();
    }
};

console.log("BuildOptimize", {
    name: common.platformName(),
    arch: common.platformArch(),
});

exports.default = async function (context) {
    console.log("BuildOptimize.output", {
        context: context,
        root: context.appOutDir,
    });
    // copy extra electron/resources/extra/[name]-[arch] to extra
    const platformName = common.platformName();
    // Use target architecture from context to support cross-arch builds
    // (e.g. building x64 and arm64 on the same ARM64 machine)
    const platformArch = archFromContext(context.arch);
    const name = platformName + "-" + platformArch;

    const srcDir = `electron/resources/extra/${name}`;
    let destDir = null;
    if (platformName === 'osx') {
        destDir = common.pathResolve(
            context.appOutDir,
            `${context.packager.appInfo.productFilename}.app`,
            "Contents",
            "Resources",
            "extra",
            name
        );
    } else if (platformName === 'win') {
        destDir = common.pathResolve(context.appOutDir, "resources", "extra", name);
    } else if (platformName === 'linux') {
        destDir = common.pathResolve(context.appOutDir, "resources", "extra", name);
    }

    console.log("BuildOptimize.copy", {
        platformName,
        platformArch,
        srcDir,
        destDir,
    });

    if (srcDir && common.exists(srcDir)) {
        console.log(`Copying from ${srcDir} to ${destDir}`);
        common.copy(srcDir, destDir, true);
        console.log(`Copy completed`);
    } else {
        console.log(`No matching source directory found for platform: ${platformName}-${platformArch}`);
    }

    // common.listFiles(context.appOutDir, true).forEach((p) => {
    // console.log('BuildOptimize.path', (p.isDir ? 'D:' : 'F:') + p.path);
    // })
    // const localeDir = context.appOutDir + "/LinkAndroid.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/";
    // console.log(`localeDir: ${localeDir}`);
    // fs.readdir(localeDir, function (err, files) {
    //     if (!(files && files.length)) {
    //         return;
    //     }
    //     for (let f of files) {
    //         if (f.endsWith('.lproj')) {
    //             if (!(f.startsWith("en") || f.startsWith("zh"))) {
    //                 const p = localeDir + f;
    //                 console.log(`removeFile: ${p}`);
    //                 fs.rmdirSync(p, {recursive: true});
    //             }
    //         }
    //     }
    // });
};
