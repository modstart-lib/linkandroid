const fs = require("node:fs");
const {resolve, join} = require("node:path");
const crypto = require("node:crypto");

const dir = (p) => {
    p = p || ''
    return join(__dirname, "../" + p)
}

const distReleaseDir = (p) => {
    if (p) {
        return dir("dist-release/" + p)
    } else {
        return dir("dist-release")
    }
}

function calcSha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", (data) => hash.update(data));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}


const platformName = () => {
    switch (process.platform) {
        case "darwin":
            return "osx";
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
            return "x86";
        case "arm64":
            return "arm64";
    }
    return null;
}

const listFiles = (dir, recursive, regex) => {
    regex = regex || null
    recursive = recursive || false
    const files = fs.readdirSync(dir);
    const list = [];
    for (let f of files) {
        const p = resolve(dir, f);
        if (regex) {
            if (!regex.test(p)) {
                continue;
            }
        }
        const stat = fs.statSync(p);
        list.push({
            isDir: stat.isDirectory(),
            name: f,
            path: p
        });
        if (recursive && stat.isDirectory()) {
            list.push(...listFiles(p, recursive));
        }
    }
    return list;
}

const copy = (src, dest, print) => {
    print = print || false
    if (!fs.existsSync(src)) {
        console.warn(`Source path does not exist: ${src}`);
        return;
    }
    if (fs.statSync(src).isDirectory()) {
        fs.mkdirSync(dest, {recursive: true});
        const files = fs.readdirSync(src);
        for (const file of files) {
            copy(join(src, file), join(dest, file));
        }
    } else {
        if (print) {
            console.log(`Copying file from ${src} to ${dest}`);
        }
        fs.copyFileSync(src, dest);
    }
}

const pathResolve = (...args)=>{
    return resolve(...args)
}

const exists = (p) => {
    try {
        return fs.existsSync(p);
    } catch (e) {
        return false;
    }
}

async function calcSha256() {
    console.log('calcSha256.start')
    const results = []
    const files = listFiles(distReleaseDir(), false, /\.(exe|dmg|AppImage|deb)$/)
    for (const p of files) {
        const sha256 = await calcSha256File(p.path);
        results.push({
            name: p.name,
            sha256: sha256
        })
    }
    const target = distReleaseDir(`sha256-${platformName()}-${platformArch()}.yml`)
    const content = results.map((r) => {
        return `${r.name}: ${r.sha256}`
    }).join("\n")
    fs.writeFileSync(target, content);
    console.log('calcSha256.end', target, results)
}

module.exports = {
    dir,
    distReleaseDir,
    platformName,
    platformArch,
    listFiles,
    copy,
    pathResolve,
    exists,
    calcSha256,
}
