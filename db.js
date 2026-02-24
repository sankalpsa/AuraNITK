// ========================================
// NITKnot — Database Wrapper (SQLite / PostgreSQL)
// ========================================
// Uses PostgreSQL when DATABASE_URL is set (production on Render)
// Falls back to SQLite for local development

const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;

console.log('--- DEBUG ENVIRONMENT ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL present:', isPostgres);
if (isPostgres) console.log('DATABASE_URL length:', process.env.DATABASE_URL.length);
console.log('-------------------------');

if (process.env.NODE_ENV === 'production' && !isPostgres) {
    console.error('❌ FATAL: Running in production but DATABASE_URL is not set!');
    console.error('Data would be lost on restart. Exiting...');
    process.exit(1);
}

let pool, sqlite;
let useSqlJs = false;
let sqlJsDb = null;
const DB_PATH = path.join(__dirname, 'nitknot.db');

if (isPostgres) {
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('🐘 Using PostgreSQL database (Production/Persistent)');

    // Test connection immediately
    pool.query('SELECT NOW()').then(() => console.log('✅ DB Connected')).catch(e => {
        console.error('❌ DB Connection Failed:', e);
        process.exit(1);
    });

} else {
    // Try better-sqlite3 first (faster, native), fall back to sql.js (pure JS)
    try {
        const Database = require('better-sqlite3');
        sqlite = new Database(DB_PATH);
        sqlite.pragma('journal_mode = WAL');
        sqlite.pragma('foreign_keys = ON');
        console.log('📁 Using SQLite database via better-sqlite3 (Local/Ephemeral)');
    } catch (e) {
        console.log('⚠️  better-sqlite3 not available, using sql.js fallback...');
        useSqlJs = true;
    }
}

// ========================================
// Unified Query Interface
// ========================================

// Convert `?` placeholders to $1, $2, ... for PostgreSQL
function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

// sql.js helper: convert statement results to array of objects
function sqlJsResultToObjects(stmt) {
    const results = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
    }
    stmt.free();
    return results;
}

// Save sql.js database to disk periodically
function saveSqlJsDb() {
    if (sqlJsDb) {
        const data = sqlJsDb.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// Query returning multiple rows
async function query(sql, params = []) {
    if (isPostgres) {
        const res = await pool.query(convertPlaceholders(sql), params);
        return res.rows;
    } else if (useSqlJs) {
        await ensureSqlJsReady();
        const stmt = sqlJsDb.prepare(sql);
        stmt.bind(params);
        return sqlJsResultToObjects(stmt);
    } else {
        return sqlite.prepare(sql).all(...params);
    }
}

// Query returning single row or null
async function queryOne(sql, params = []) {
    if (isPostgres) {
        const res = await pool.query(convertPlaceholders(sql), params);
        return res.rows[0] || null;
    } else if (useSqlJs) {
        await ensureSqlJsReady();
        const stmt = sqlJsDb.prepare(sql);
        stmt.bind(params);
        const rows = sqlJsResultToObjects(stmt);
        return rows[0] || null;
    } else {
        return sqlite.prepare(sql).get(...params) || null;
    }
}

// Execute INSERT/UPDATE/DELETE, return { lastId, changes }
async function run(sql, params = []) {
    if (isPostgres) {
        // For INSERT, add RETURNING id to get lastId
        let modifiedSql = convertPlaceholders(sql);
        const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !modifiedSql.toUpperCase().includes('RETURNING')) {
            modifiedSql += ' RETURNING id';
        }
        const res = await pool.query(modifiedSql, params);
        return {
            lastId: res.rows[0]?.id || null,
            changes: res.rowCount
        };
    } else if (useSqlJs) {
        await ensureSqlJsReady();
        sqlJsDb.run(sql, params);
        const changes = sqlJsDb.getRowsModified();
        // Get last insert rowid  
        const lastIdRow = sqlJsDb.exec('SELECT last_insert_rowid() as id');
        const lastId = lastIdRow.length > 0 && lastIdRow[0].values.length > 0 ? lastIdRow[0].values[0][0] : null;
        saveSqlJsDb();
        return { lastId, changes };
    } else {
        const result = sqlite.prepare(sql).run(...params);
        return {
            lastId: result.lastInsertRowid,
            changes: result.changes
        };
    }
}

// Initialize sql.js database (lazy, async)
let sqlJsReadyPromise = null;
async function ensureSqlJsReady() {
    if (sqlJsDb) return;
    if (sqlJsReadyPromise) return sqlJsReadyPromise;
    sqlJsReadyPromise = (async () => {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            sqlJsDb = new SQL.Database(fileBuffer);
        } else {
            sqlJsDb = new SQL.Database();
        }
        sqlJsDb.run('PRAGMA foreign_keys = ON');
        console.log('📁 Using SQLite database via sql.js (Local/Ephemeral)');
        // Auto-save every 5 seconds
        setInterval(saveSqlJsDb, 5000);
    })();
    return sqlJsReadyPromise;
}

// ========================================
// Table Initialization
// ========================================

// Helper to run SQL on whichever SQLite engine is active
function sqliteExec(sql) {
    if (useSqlJs) {
        sqlJsDb.run(sql);
    } else {
        sqlite.exec(sql);
    }
}

function sqliteRunStmt(sql, params = []) {
    if (useSqlJs) {
        sqlJsDb.run(sql, params);
    } else {
        sqlite.prepare(sql).run(...params);
    }
}

async function initTables() {
    if (useSqlJs) {
        await ensureSqlJsReady();
    }

    if (isPostgres) {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                branch TEXT NOT NULL,
                year TEXT NOT NULL,
                bio TEXT DEFAULT '',
                photo TEXT DEFAULT '',
                show_me TEXT DEFAULT 'all',
                interests TEXT DEFAULT '[]',
                green_flags TEXT DEFAULT '[]',
                red_flags TEXT DEFAULT '[]',
                is_verified INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS swipes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                target_id INTEGER NOT NULL REFERENCES users(id),
                action TEXT NOT NULL CHECK(action IN ('like','pass')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, target_id)
            );

            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                user1_id INTEGER NOT NULL REFERENCES users(id),
                user2_id INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user1_id, user2_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                match_id INTEGER NOT NULL REFERENCES matches(id),
                sender_id INTEGER NOT NULL REFERENCES users(id),
                text TEXT NOT NULL,
                reply_to_id INTEGER REFERENCES messages(id),
                is_read INTEGER DEFAULT 0,
                image_url TEXT,
                voice_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                reporter_id INTEGER NOT NULL REFERENCES users(id),
                reported_id INTEGER NOT NULL REFERENCES users(id),
                reason TEXT NOT NULL,
                details TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_photos (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                is_primary INTEGER DEFAULT 0,
                position INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_swipes_user ON swipes(user_id);
            CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(target_id);
            CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id);
            CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id);
            CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);
            CREATE INDEX IF NOT EXISTS idx_user_photos_user ON user_photos(user_id);
        `);
    } else {
        // Use whichever SQLite engine is available
        const createStatements = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                branch TEXT NOT NULL,
                year TEXT NOT NULL,
                bio TEXT DEFAULT '',
                photo TEXT DEFAULT '',
                show_me TEXT DEFAULT 'all',
                interests TEXT DEFAULT '[]',
                green_flags TEXT DEFAULT '[]',
                red_flags TEXT DEFAULT '[]',
                is_verified INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS swipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                target_id INTEGER NOT NULL,
                action TEXT NOT NULL CHECK(action IN ('like','pass')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (target_id) REFERENCES users(id),
                UNIQUE(user_id, target_id)
            )`,
            `CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users(id),
                FOREIGN KEY (user2_id) REFERENCES users(id),
                UNIQUE(user1_id, user2_id)
            )`,
            `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                reply_to_id INTEGER,
                is_read INTEGER DEFAULT 0,
                image_url TEXT,
                voice_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches(id),
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (reply_to_id) REFERENCES messages(id)
            )`,
            `CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                reported_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                details TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(id),
                FOREIGN KEY (reported_id) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS user_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                photo_url TEXT NOT NULL,
                is_primary INTEGER DEFAULT 0,
                position INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS message_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                reaction TEXT NOT NULL DEFAULT '❤️',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(message_id, user_id)
            )`,
            `CREATE TABLE IF NOT EXISTS profile_prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                position INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE INDEX IF NOT EXISTS idx_swipes_user ON swipes(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(target_id)`,
            `CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id)`,
            `CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id)`,
            `CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_photos_user ON user_photos(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id)`,
            `CREATE INDEX IF NOT EXISTS idx_profile_prompts_user ON profile_prompts(user_id)`
        ];
        for (const stmt of createStatements) {
            try { sqliteExec(stmt); } catch (e) { /* table/index may already exist */ }
        }
    }

    // Auto-migrations
    const migrations = [
        'ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1',
        'ALTER TABLE messages ADD COLUMN reply_to_id INTEGER',
        'ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0',
        'ALTER TABLE swipes ADD COLUMN is_super_like INTEGER DEFAULT 0',
        'ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0',
        'ALTER TABLE messages ADD COLUMN image_url TEXT',
        'ALTER TABLE messages ADD COLUMN voice_url TEXT',
        "ALTER TABLE users ADD COLUMN pickup_line TEXT DEFAULT ''",
        // New feature migrations
        'ALTER TABLE users ADD COLUMN is_snoozed INTEGER DEFAULT 0',
        'ALTER TABLE users ADD COLUMN snooze_until TEXT',
        "ALTER TABLE users ADD COLUMN spotify_artist TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN spotify_song TEXT DEFAULT ''",
    ];

    for (const migration of migrations) {
        try {
            if (isPostgres) {
                const colName = migration.match(/ADD COLUMN (\w+)/)?.[1];
                const tableName = migration.match(/ALTER TABLE (\w+)/)?.[1];
                if (colName && tableName) {
                    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${migration.split('ADD COLUMN ')[1]}`);
                }
            } else {
                sqliteRunStmt(migration);
            }
        } catch (e) {
            // Column likely already exists
        }
    }

    // Save sql.js db after init
    if (useSqlJs) saveSqlJsDb();

    console.log('✅ Database tables initialized');
}

module.exports = { query, queryOne, run, initTables, isPostgres };


