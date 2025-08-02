import {AppConfig} from "../../../src/config";
import {platformArch, platformName, platformUUID, platformVersion} from "../../lib/env";

const checkForUpdate = async () => {
    try {
        const res = await fetch(AppConfig.updaterUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                version: AppConfig.version,
                uuid: platformUUID(),
                platform: {
                    name: platformName(),
                    version: platformVersion(),
                    arch: platformArch(),
                },
            }),
        });
        return await res.json();
    } catch (e) {
        return {
            code: -1,
            msg: `Failed to check update : ${e.message}`,
        };
    }
};

export default {
    checkForUpdate,
};
