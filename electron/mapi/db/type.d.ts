type DB = {
    execute(sql: string, params?: any): Promise<any>;
    insert(sql: string, params?: any): Promise<any>;
    first(sql: string, params?: any): Promise<any>;
    select(sql: string, params?: any): Promise<any>;
    update(sql: string, params?: any): Promise<any>;
    delete(sql: string, params?: any): Promise<any>;
};
