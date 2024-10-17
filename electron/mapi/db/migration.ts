const versions = [
    {
        version: 0,
        up: async (db: DB) => {
            // await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`);
            // console.log('result1', await db.execute(`INSERT INTO users (name, email) VALUES (?, ?)`,['Alice', 'alice@example.com']));
            // console.log('result2', await db.select (`SELECT * FROM users`));
            // console.log('result2', await db.first (`SELECT * FROM users`));
        }
    }
]

export default {
    versions,
}


