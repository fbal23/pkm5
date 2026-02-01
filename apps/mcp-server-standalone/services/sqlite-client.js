'use strict';

const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Get the database path.
 * Priority: RAH_DB_PATH env var > default app data location
 */
function getDatabasePath() {
  if (process.env.RAH_DB_PATH) {
    return process.env.RAH_DB_PATH;
  }

  // Default: ~/Library/Application Support/RA-H/db/rah.sqlite
  return path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'RA-H',
    'db',
    'rah.sqlite'
  );
}

let db = null;

/**
 * Initialize the database connection.
 * Call this once at startup.
 */
function initDatabase() {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database not found at: ${dbPath}\n\n` +
      `Have you run RA-H at least once? The database is created when you first launch the app.\n\n` +
      `If your database is in a different location, set the RAH_DB_PATH environment variable.`
    );
  }

  db = new Database(dbPath);

  // Configure SQLite for performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 5000');
  db.pragma('busy_timeout = 5000');

  return db;
}

/**
 * Get the database instance.
 * Throws if not initialized.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Execute a query and return rows.
 */
function query(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);

  const sqlLower = sql.trim().toLowerCase();
  if (sqlLower.startsWith('select') || sqlLower.startsWith('with') || sqlLower.includes('returning')) {
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  } else {
    const result = params.length > 0 ? stmt.run(...params) : stmt.run();
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }
}

/**
 * Execute a query in a transaction.
 */
function transaction(callback) {
  const database = getDb();
  const txn = database.transaction(callback);
  return txn();
}

/**
 * Close the database connection.
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  query,
  transaction,
  closeDatabase,
  getDatabasePath
};
