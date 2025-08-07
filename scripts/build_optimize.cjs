const common = require("./common.cjs");

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
    const platformArch = common.platformArch();
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
