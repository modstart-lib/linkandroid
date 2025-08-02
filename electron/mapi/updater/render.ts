import updaterIndex from "./index";
import {ipcRenderer} from "electron";

const getCheckAtLaunch = async (): Promise<"yes" | "no"> => {
    return ipcRenderer.invoke("updater:getCheckAtLaunch");
};

const setCheckAtLaunch = async (value: "yes" | "no"): Promise<void> => {
    return ipcRenderer.invoke("updater:setCheckAtLaunch", value);
};

export default {
    ...updaterIndex,
    getCheckAtLaunch,
    setCheckAtLaunch,
};
