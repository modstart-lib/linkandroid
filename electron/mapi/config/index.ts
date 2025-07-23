import {callHandleFromMainOrRender} from "../env";

const all = async () => {
    return callHandleFromMainOrRender('config:all');
}

const get = async (key: string, defaultValue: any = null) => {
    return callHandleFromMainOrRender('config:get', key, defaultValue);
}
const set = async (key: string, value: any) => {
    await callHandleFromMainOrRender('config:set', key, value);
}

const allEnv = async () => {
    return callHandleFromMainOrRender('config:allEnv');
}

const getEnv = async (key: string, defaultValue: any = null) => {
    return callHandleFromMainOrRender('config:getEnv', key, defaultValue);
}

const setEnv = async (key: string, value: any) => {
    await callHandleFromMainOrRender('config:setEnv', key, value);
}

export const ConfigIndex = {
    all,
    get,
    set,
    allEnv,
    getEnv,
    setEnv
}
