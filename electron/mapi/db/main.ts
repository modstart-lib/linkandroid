import sqlite3, {Database} from "better-sqlite3";
import path from "node:path";
import migration from "./migration";
import {AppEnv} from "../env";
import {Log} from "../log/main";
import {ipcMain} from "electron";
import fs from "node:fs";
import {Files} from "../file/main";

let dbPath: string | null = null;
let dbConn: Database | null = null;
let dbSuccess = false;

const db = {
    /**
     * 检查数据库连接是否已初始化
     * @throws {string} 如果数据库未初始化则抛出异常
     */
    _check() {
        if (!dbSuccess) {
            throw "DBNotInitialized";
        }
    },
    /**
     * 执行SQL语句（无返回值）
     * @param {string} sql - SQL语句
     * @param {any[]} params - 参数数组
     * @returns {Promise<void>}
     */
    async execute(sql: string, params: any = []): Promise<void> {
        db._check();
        try {
            dbConn.prepare(sql).run(...params);
        } catch (err) {
            throw err;
        }
    },
    /**
     * 插入数据并返回插入的行ID
     * @param {string} sql - SQL语句
     * @param {any[]} params - 参数数组
     * @returns {Promise<string | number>} 插入的行ID
     */
    async insert(sql: string, params: any = []): Promise<string | number> {
        db._check();
        try {
            const result = dbConn.prepare(sql).run(...params);
            return result.lastInsertRowid;
        } catch (err) {
            throw err;
        }
    },
    /**
     * 查询单行数据
     * @param {string} sql - SQL语句
     * @param {any[]} params - 参数数组
     * @returns {Promise<any>} 查询结果
     */
    async first(sql: string, params: any = []): Promise<any> {
        db._check();
        try {
            return dbConn.prepare(sql).get(...params);
        } catch (err) {
            throw err;
        }
    },
    /**
     * 查询多行数据
     * @param {string} sql - SQL语句
     * @param {any[]} params - 参数数组
     * @returns {Promise<any[]>} 查询结果数组
     */
    async select(sql: string, params: any = []): Promise<any[]> {
        db._check();
        try {
            return dbConn.prepare(sql).all(...params);
        } catch (err) {
            throw err;
        }
    },
    /**
     * 更新数据并返回影响的行数
     * @param {string} sql - SQL语句
     * @param {any[]} params - 参数数组
     * @returns {Promise<number>} 影响的行数
     */
    async update(sql: string, params: any = []): Promise<number> {
        db._check();
        try {
            const result = dbConn.prepare(sql).run(...params);
            return result.changes;
        } catch (err) {
            throw err;
        }
    },
    /**
     * 删除数据并返回影响的行数
     * @param {string} sql - SQL语句
     * @param {any[]} params - 参数数组
     * @returns {Promise<number>} 影响的行数
     */
    async delete(sql: string, params: any = []): Promise<number> {
        db._check();
        try {
            const result = dbConn.prepare(sql).run(...params);
            return result.changes;
        } catch (err) {
            throw err;
        }
    },
};

const migrate = async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS migrate
                      (
                          id
                          INTEGER
                          PRIMARY
                          KEY,
                          version
                          INTEGER
                      )`);
    for (const version of migration.versions) {
        const result = await db.first(
            `SELECT *
             FROM migrate
             WHERE version = ?`,
            [version.version]
        );
        if (!result) {
            Log.info(`DB.Migrate`, {version: version.version});
            await version.up(db);
            await db.execute(
                `INSERT INTO migrate (version)
                 VALUES (?)`,
                [version.version]
            );
        }
    }
};

/**
 * 初始化数据库连接
 * @returns {Promise<void>}
 */
const init = async () => {
    dbPath = path.join(AppEnv.dataRoot, "database.db");
    const userDbPath = path.join(AppEnv.userData, "database.db");
    if (fs.existsSync(userDbPath)) {
        dbPath = userDbPath;
    }
    try {
        dbConn = new sqlite3(dbPath);
        dbSuccess = true;
        await migrate();
        Log.info("Database connected successfully");
    } catch (err) {
        Log.error("DBConnect SQLite database failed:", err.message);
        throw err;
    }
};

ipcMain.handle("db:execute", (event, sql: string, params: any) => {
    return db.execute(sql, params);
});
ipcMain.handle("db:insert", (event, sql: string, params: any) => {
    return db.insert(sql, params);
});
ipcMain.handle("db:first", (event, sql: string, params: any) => {
    return db.first(sql, params);
});
ipcMain.handle("db:select", (event, sql: string, params: any) => {
    return db.select(sql, params);
});
ipcMain.handle("db:update", (event, sql: string, params: any) => {
    return db.update(sql, params);
});
ipcMain.handle("db:delete", (event, sql: string, params: any) => {
    return db.delete(sql, params);
});

export const DBMain = {
    init,
    execute: db.execute,
    insert: db.insert,
    first: db.first,
    select: db.select,
    update: db.update,
    delete: db.delete,
};

export default DBMain;
