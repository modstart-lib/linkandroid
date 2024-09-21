const fs = require("fs");

exports.default = async function (context) {
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
