import fileIndex from "./index";
import {ipcRenderer} from "electron";

const openFile = async (options: {} = {}) => {
    return ipcRenderer.invoke("file:openFile", options);
};

const openDirectory = async (options: {} = {}) => {
    return ipcRenderer.invoke("file:openDirectory", options);
};

const openSave = async (options: {} = {}) => {
    return ipcRenderer.invoke("file:openSave", options);
};

const openPath = async (path: string, options: {} = {}) => {
    return ipcRenderer.invoke("file:openPath", path, options);
};

export default {
    ...fileIndex,
    openFile,
    openDirectory,
    openSave,
    openPath,
};
