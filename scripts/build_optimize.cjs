const common = require('./common.cjs')

console.log('BuildOptimize', {
    name: common.platformName(),
    arch: common.platformArch(),
});

exports.default = async function (context) {
    console.log('BuildOptimize.output', {
        context: context,
        root: context.appOutDir
    })
    common.listFiles(context.appOutDir, true).forEach((p) => {
        // console.log('BuildOptimize.path', (p.isDir ? 'D:' : 'F:') + p.path);
    })
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
