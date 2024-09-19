import {AppConfig} from "../../../src/config";

const checkForUpdate = async () => {
    try {
        const res = await fetch(AppConfig.updaterUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{}'
        })
        return await res.json()
    } catch (e) {
        return {
            code: -1,
            msg: `Failed to check update : ${e.message}`
        }
    }
}
export default {
    checkForUpdate,
}
