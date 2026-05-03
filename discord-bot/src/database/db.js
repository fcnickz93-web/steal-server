const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

const dbDir = path.dirname(path.resolve(config.databasePath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const FILES = {
  clones: path.join(dbDir, 'clones.json'),
  snapshots: path.join(dbDir, 'snapshots.json'),
  commandLogs: path.join(dbDir, 'command_logs.json'),
};

function readFile(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function nextId(records) {
  if (!records.length) return 1;
  return Math.max(...records.map((r) => r.id)) + 1;
}

function init() {
  for (const file of Object.values(FILES)) {
    if (!fs.existsSync(file)) writeFile(file, []);
  }
  logger.info('Banco de dados JSON inicializado com sucesso.');
}

function logCommand(userId, userTag, guildId, command, args, success = true) {
  const logs = readFile(FILES.commandLogs);
  logs.push({
    id: nextId(logs),
    user_id: userId,
    user_tag: userTag,
    guild_id: guildId,
    command,
    args: JSON.stringify(args),
    executed_at: new Date().toISOString(),
    success: success ? 1 : 0,
  });
  if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  writeFile(FILES.commandLogs, logs);
}

function saveClone(data) {
  const clones = readFile(FILES.clones);
  const record = {
    id: nextId(clones),
    source_guild_id: data.sourceGuildId || null,
    source_guild_name: data.sourceGuildName || null,
    target_guild_id: data.targetGuildId,
    target_guild_name: data.targetGuildName,
    cloned_by: data.clonedBy,
    cloned_at: new Date().toISOString(),
    status: data.status || 'completed',
    details: JSON.stringify(data.details || {}),
  };
  clones.push(record);
  writeFile(FILES.clones, clones);
  return { lastInsertRowid: record.id };
}

function saveSnapshot(guildId, guildName, createdBy, snapshotData) {
  const snapshots = readFile(FILES.snapshots);
  const record = {
    id: nextId(snapshots),
    guild_id: guildId,
    guild_name: guildName,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    snapshot_data: JSON.stringify(snapshotData),
  };
  snapshots.push(record);
  writeFile(FILES.snapshots, snapshots);
  return { lastInsertRowid: record.id };
}

function getSnapshots(guildId) {
  const snapshots = readFile(FILES.snapshots);
  return snapshots
    .filter((s) => s.guild_id === guildId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(({ id, guild_name, created_by, created_at }) => ({ id, guild_name, created_by, created_at }));
}

function getSnapshot(id) {
  const snapshots = readFile(FILES.snapshots);
  const row = snapshots.find((s) => s.id === id);
  if (!row) return null;
  return { ...row, snapshot_data: JSON.parse(row.snapshot_data) };
}

module.exports = { init, logCommand, saveClone, saveSnapshot, getSnapshots, getSnapshot };
