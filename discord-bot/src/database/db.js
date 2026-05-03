const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('../utils/logger');

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_guild_id TEXT,
      source_guild_name TEXT,
      target_guild_id TEXT NOT NULL,
      target_guild_name TEXT NOT NULL,
      cloned_by TEXT NOT NULL,
      cloned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'completed',
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      guild_name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      snapshot_data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      guild_id TEXT,
      command TEXT NOT NULL,
      args TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 1
    );
  `);
  logger.info('Banco de dados inicializado com sucesso.');
}

function logCommand(userId, userTag, guildId, command, args, success = true) {
  db.prepare(
    `INSERT INTO command_logs (user_id, user_tag, guild_id, command, args, success)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, userTag, guildId, command, JSON.stringify(args), success ? 1 : 0);
}

function saveClone(data) {
  return db.prepare(
    `INSERT INTO clones (source_guild_id, source_guild_name, target_guild_id, target_guild_name, cloned_by, status, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.sourceGuildId || null,
    data.sourceGuildName || null,
    data.targetGuildId,
    data.targetGuildName,
    data.clonedBy,
    data.status || 'completed',
    JSON.stringify(data.details || {})
  );
}

function saveSnapshot(guildId, guildName, createdBy, snapshotData) {
  return db.prepare(
    `INSERT INTO snapshots (guild_id, guild_name, created_by, snapshot_data)
     VALUES (?, ?, ?, ?)`
  ).run(guildId, guildName, createdBy, JSON.stringify(snapshotData));
}

function getSnapshots(guildId) {
  return db.prepare(
    `SELECT id, guild_name, created_by, created_at FROM snapshots WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10`
  ).all(guildId);
}

function getSnapshot(id) {
  const row = db.prepare(`SELECT * FROM snapshots WHERE id = ?`).get(id);
  if (!row) return null;
  return { ...row, snapshot_data: JSON.parse(row.snapshot_data) };
}

module.exports = { init, logCommand, saveClone, saveSnapshot, getSnapshots, getSnapshot };
