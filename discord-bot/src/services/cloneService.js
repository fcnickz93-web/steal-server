const { ChannelType } = require('discord.js');
const logger = require('../utils/logger');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveInvite(client, code) {
  try {
    return await client.fetchInvite(code);
  } catch {
    return null;
  }
}

async function snapshotGuild(guild) {
  const snapshot = {
    name: guild.name,
    description: guild.description || null,
    icon: guild.iconURL({ extension: 'png', size: 4096 }) || null,
    banner: guild.bannerURL({ extension: 'png', size: 4096 }) || null,
    splash: guild.splashURL({ extension: 'png', size: 4096 }) || null,
    verificationLevel: guild.verificationLevel,
    explicitContentFilter: guild.explicitContentFilter,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    afkTimeout: guild.afkTimeout,
    preferredLocale: guild.preferredLocale,
    roles: [],
    categories: [],
    channels: [],
    emojis: [],
    stickers: [],
  };

  // ── ROLES ─────────────────────────────────────────────────────────────────
  await guild.roles.fetch();
  snapshot.roles = guild.roles.cache
    .filter((r) => !r.managed && r.id !== guild.id)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }));

  // ── CHANNELS ──────────────────────────────────────────────────────────────
  await guild.channels.fetch();

  const serializeOverwrites = (ch) =>
    ch.permissionOverwrites?.cache?.map((o) => ({
      id: o.id,
      type: o.type,
      allow: o.allow.bitfield.toString(),
      deny: o.deny.bitfield.toString(),
    })) || [];

  snapshot.categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      permissionOverwrites: serializeOverwrites(c),
    }));

  const supportedTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
  ];

  snapshot.channels = guild.channels.cache
    .filter((c) => supportedTypes.includes(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      name: c.name,
      type: c.type,
      position: c.position,
      topic: c.topic || null,
      nsfw: c.nsfw || false,
      rateLimitPerUser: c.rateLimitPerUser || 0,
      userLimit: c.userLimit || 0,
      bitrate: c.bitrate || null,
      parentId: c.parentId || null,
      parentName: c.parent?.name || null,
      permissionOverwrites: serializeOverwrites(c),
      defaultAutoArchiveDuration: c.defaultAutoArchiveDuration || null,
    }));

  // ── EMOJIS ────────────────────────────────────────────────────────────────
  try {
    await guild.emojis.fetch();
    snapshot.emojis = guild.emojis.cache.map((e) => ({
      name: e.name,
      url: e.imageURL({ extension: e.animated ? 'gif' : 'png', size: 128 }),
      animated: e.animated,
    }));
  } catch { snapshot.emojis = []; }

  // ── STICKERS ──────────────────────────────────────────────────────────────
  try {
    await guild.stickers.fetch();
    snapshot.stickers = guild.stickers.cache.map((s) => ({
      name: s.name,
      description: s.description || '',
      url: s.url,
      tags: s.tags || '',
    }));
  } catch { snapshot.stickers = []; }

  logger.info(
    `Snapshot "${guild.name}": ${snapshot.roles.length} cargos, ` +
    `${snapshot.categories.length} cats, ${snapshot.channels.length} canais, ` +
    `${snapshot.emojis.length} emojis, ${snapshot.stickers.length} stickers`
  );

  return snapshot;
}

async function applySnapshot(targetGuild, snapshot, progress) {
  const report = {
    roles: { created: 0, failed: 0 },
    categories: { created: 0, failed: 0 },
    channels: { created: 0, failed: 0 },
    emojis: { created: 0, failed: 0 },
    stickers: { created: 0, failed: 0 },
    errors: [],
  };

  const roleMap = new Map();     // sourceRoleId → newRoleId
  const categoryMap = new Map(); // sourceCategoryId → newChannelId

  // ── 1. SNAPSHOT FIRST — delete after ─────────────────────────────────────
  // (snapshot is already done before this function is called)

  // ── 2. WIPE TARGET ────────────────────────────────────────────────────────
  await progress('🗑️ Deletando todos os canais...');
  const channelsToDel = [...targetGuild.channels.cache.filter((c) => c.deletable).values()];
  for (const ch of channelsToDel) {
    await ch.delete('Clone: wipe').catch(() => {});
    await sleep(200);
  }

  await progress('🗑️ Deletando todos os cargos...');
  const myHighest = targetGuild.members.me.roles.highest;
  const rolesToDel = [...targetGuild.roles.cache
    .filter((r) => !r.managed && r.id !== targetGuild.id && r.comparePositionTo(myHighest) < 0)
    .values()];
  for (const role of rolesToDel) {
    await role.delete('Clone: wipe').catch(() => {});
    await sleep(150);
  }

  // ── 3. ROLES ──────────────────────────────────────────────────────────────
  await progress(`🎭 Criando ${snapshot.roles.length} cargos...`);
  for (const r of snapshot.roles) {
    try {
      const created = await targetGuild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable,
        permissions: BigInt(r.permissions),
        reason: 'Clone',
      });
      roleMap.set(r.id, created.id);
      roleMap.set(r.name, created.id);
      report.roles.created++;
      await sleep(250);
    } catch (err) {
      report.roles.failed++;
      report.errors.push(`Cargo "${r.name}": ${err.message}`);
    }
  }

  // ── 4. CATEGORIES ─────────────────────────────────────────────────────────
  await progress(`📁 Criando ${snapshot.categories.length} categorias...`);
  for (const cat of snapshot.categories) {
    try {
      const overwrites = buildOverwrites(cat.permissionOverwrites, roleMap, targetGuild);
      const created = await targetGuild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
        reason: 'Clone',
      });
      categoryMap.set(cat.id, created.id);
      categoryMap.set(cat.name, created.id);
      report.categories.created++;
      await sleep(350);
    } catch (err) {
      report.categories.failed++;
      report.errors.push(`Categoria "${cat.name}": ${err.message}`);
    }
  }

  // ── 5. CHANNELS ───────────────────────────────────────────────────────────
  await progress(`💬 Criando ${snapshot.channels.length} canais...`);
  for (const ch of snapshot.channels) {
    try {
      const overwrites = buildOverwrites(ch.permissionOverwrites, roleMap, targetGuild);

      const options = {
        name: ch.name,
        type: ch.type,
        nsfw: ch.nsfw,
        permissionOverwrites: overwrites,
        reason: 'Clone',
      };

      // Parent category
      const parentId = (ch.parentId && categoryMap.get(ch.parentId))
        || (ch.parentName && categoryMap.get(ch.parentName))
        || null;
      if (parentId) options.parent = parentId;

      // Text / Announcement / Forum
      if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(ch.type)) {
        if (ch.topic) options.topic = ch.topic;
        options.rateLimitPerUser = ch.rateLimitPerUser || 0;
        if (ch.defaultAutoArchiveDuration) options.defaultAutoArchiveDuration = ch.defaultAutoArchiveDuration;
      }

      // Voice / Stage
      if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch.type)) {
        options.userLimit = ch.userLimit || 0;
        options.bitrate = ch.bitrate ? Math.min(ch.bitrate, 96000) : 64000;
      }

      await targetGuild.channels.create(options);
      report.channels.created++;
      await sleep(400);
    } catch (err) {
      report.channels.failed++;
      report.errors.push(`Canal "${ch.name}": ${err.message}`);
    }
  }

  // ── 6. EMOJIS ─────────────────────────────────────────────────────────────
  if (snapshot.emojis.length > 0) {
    await progress(`😀 Copiando ${Math.min(snapshot.emojis.length, 50)} emojis...`);
    for (const e of snapshot.emojis.slice(0, 50)) {
      try {
        await targetGuild.emojis.create({ attachment: e.url, name: e.name, reason: 'Clone' });
        report.emojis.created++;
        await sleep(500);
      } catch { report.emojis.failed++; }
    }
  }

  // ── 7. STICKERS ───────────────────────────────────────────────────────────
  if (snapshot.stickers?.length > 0) {
    await progress(`🎟️ Copiando ${Math.min(snapshot.stickers.length, 5)} stickers...`);
    for (const s of snapshot.stickers.slice(0, 5)) {
      try {
        await targetGuild.stickers.create({
          file: s.url,
          name: s.name,
          tags: s.tags || 'clone',
          description: s.description || '',
          reason: 'Clone',
        });
        report.stickers.created++;
        await sleep(600);
      } catch { report.stickers.failed++; }
    }
  }

  // ── 8. SERVER SETTINGS ────────────────────────────────────────────────────
  await progress('⚙️ Aplicando configurações do servidor...');
  try {
    const editOpts = {
      name: snapshot.name,
      verificationLevel: snapshot.verificationLevel,
      explicitContentFilter: snapshot.explicitContentFilter,
      defaultMessageNotifications: snapshot.defaultMessageNotifications,
      preferredLocale: snapshot.preferredLocale,
      reason: 'Clone',
    };
    if (snapshot.description) editOpts.description = snapshot.description;
    if (snapshot.afkTimeout)  editOpts.afkTimeout  = snapshot.afkTimeout;
    if (snapshot.icon)        editOpts.icon         = snapshot.icon;
    if (snapshot.banner)      editOpts.banner        = snapshot.banner;
    await targetGuild.edit(editOpts);
  } catch (err) {
    report.errors.push(`Config: ${err.message}`);
  }

  await progress('🏁 Concluído!');
  return report;
}

/**
 * Remap source role IDs → new target role IDs in permission overwrites.
 * Type 0 = role, Type 1 = member (kept as-is).
 */
function buildOverwrites(rawOverwrites, roleMap, targetGuild) {
  if (!rawOverwrites?.length) return [];
  const result = [];
  for (const o of rawOverwrites) {
    if (o.type === 0) {
      const newId = o.id === targetGuild.id ? targetGuild.id : roleMap.get(o.id);
      if (!newId) continue;
      result.push({ id: newId, type: 0, allow: BigInt(o.allow), deny: BigInt(o.deny) });
    } else {
      result.push({ id: o.id, type: 1, allow: BigInt(o.allow), deny: BigInt(o.deny) });
    }
  }
  return result;
}

module.exports = { resolveInvite, snapshotGuild, applySnapshot };
