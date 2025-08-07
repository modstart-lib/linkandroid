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

export default {
    ...fileIndex,
    openFile,
    openDirectory,
    openSave,
};
