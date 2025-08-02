import {ipcRenderer} from "electron";

const init = () => {};

const execute = async (sql: string, params: any = []) => {
    return ipcRenderer.invoke("db:execute", sql, params);
};

const insert = async (sql: string, params: any = []) => {
    return ipcRenderer.invoke("db:insert", sql, params);
};

const first = async (sql: string, params: any = []) => {
    return ipcRenderer.invoke("db:first", sql, params);
};

const select = async (sql: string, params: any = []) => {
    return ipcRenderer.invoke("db:select", sql, params);
};

const update = async (sql: string, params: any = []) => {
    return ipcRenderer.invoke("db:update", sql, params);
};

const deletes = async (sql: string, params: any = []) => {
    return ipcRenderer.invoke("db:delete", sql, params);
};

export default {
    init,
    execute,
    insert,
    first,
    select,
    update,
    delete: deletes,
};
