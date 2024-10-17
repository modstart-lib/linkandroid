import sqlite3, {Database} from 'sqlite3';
import path from "node:path";
import migration from './migration';
import {AppEnv} from "../env";
import {Log} from "../log/main";
import {ipcMain} from "electron";

let dbPath: string | null = null
let dbConn: Database | null = null;
let dbSuccess = false;

const db = {
    async execute(sql: string, params: any = []) {
        return new Promise((resolve, reject) => {
            if (!dbSuccess) {
                reject('DB not initialized');
            } else {
                dbConn.prepare(sql).run(...params, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            }
        });
    },
    async insert(sql: string, params: any = []) {
        return await this.execute(sql, params);
    },
    async first(sql: string, params: any = []) {
        return new Promise((resolve, reject) => {
            if (!dbSuccess) {
                reject('DB not initialized');
            } else {
                dbConn.prepare(sql).get(...params, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            }
        });
    },
    async select(sql: string, params: any = []) {
        return new Promise((resolve, reject) => {
            if (!dbSuccess) {
                reject('DB not initialized');
            } else {
                dbConn.prepare(sql).all(...params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            }
        });
    },
    async update(sql: string, params: any = []) {
        return await this.execute(sql, params);
    },
    async delete(sql: string, params: any = []) {
        return await this.execute(sql, params);
    }
}


const migrate = async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS migrate
                      (
                          id INTEGER PRIMARY KEY,
                          version INTEGER
                      )`);
    for (const version of migration.versions) {
        const result = await db.execute(`SELECT * FROM migrate WHERE version = ?`, [version.version]);
        if (!result) {
            Log.info(`Migrating to version ${version.version}`);
            await version.up(db);
            await db.execute(`INSERT INTO migrate (version) VALUES (?)`, [version.version]);
        }
    }
}

const init = () => {
    dbPath = path.join(AppEnv.userData, 'database.db')
    dbConn = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            Log.error('DBConnect SQLite database failed:', err.message);
        } else {
            dbSuccess = true;
            migrate().then()
        }
    });
}

ipcMain.handle('db:execute', (event, sql: string, params: any) => {
    return db.execute(sql, params);
})
ipcMain.handle('db:insert', (event, sql: string, params: any) => {
    return db.insert(sql, params);
})
ipcMain.handle('db:first', (event, sql: string, params: any) => {
    return db.first(sql, params);
})
ipcMain.handle('db:select', (event, sql: string, params: any) => {
    return db.select(sql, params);
})
ipcMain.handle('db:update', (event, sql: string, params: any) => {
    return db.update(sql, params);
})
ipcMain.handle('db:delete', (event, sql: string, params: any) => {
    return db.delete(sql, params);
})

export default {
    init,
    execute: db.execute,
    insert: db.insert,
    first: db.first,
    select: db.select,
    update: db.update,
    delete: db.delete
}
