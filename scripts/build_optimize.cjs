const fs = require("fs");
const {resolve} = require("node:path");

const platformName = () => {
    switch (process.platform) {
        case "darwin":
            return "mac";
        case "win32":
            return "win";
        case "linux":
            return "linux";
    }
    return null;
}

const platformArch = () => {
    switch (process.arch) {
        case "x64":
            return "x64";
        case "arm64":
            return "arm64";
    }
    return null;
}

const listFiles = (dir, recursive) => {
    recursive = recursive || false
    const files = fs.readdirSync(dir);
    const list = [];
    for (let f of files) {
        const p = resolve(dir, f);
        const stat = fs.statSync(p);
        list.push({
            isDir: stat.isDirectory(),
            path: p
        });
        if (recursive && stat.isDirectory()) {
            list.push(...listFiles(p, recursive));
        }
    }
    return list;
}

console.log('BuildOptimize', {
    name: platformName(),
    arch: platformArch(),
});

exports.default = async function (context) {
    console.log('BuildOptimize.output', {
        context: context,
        root: context.appOutDir
    })
    listFiles(context.appOutDir, true).forEach((p) => {
        console.log('BuildOptimize.path', (p.isDir ? 'D:' : 'F:') + p.path);
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
