const config = require('../config/config');
const logger = require('./logger');

function isOwner(userId) {
  return userId === config.ownerId;
}

function isAdmin(member) {
  return (
    member.permissions.has('Administrator') ||
    member.permissions.has('ManageGuild') ||
    isOwner(member.id)
  );
}

function hasPermission(member, commandName) {
  if (isOwner(member.id)) return true;

  if (config.permissions.ownerOnly.includes(commandName)) {
    return false;
  }

  if (config.permissions.adminOnly.includes(commandName)) {
    return isAdmin(member);
  }

  return true;
}

function check(message, commandName) {
  const { member } = message;
  if (!member) return false;

  const allowed = hasPermission(member, commandName);
  if (!allowed) {
    logger.warn(`Acesso negado: ${message.author.tag} tentou usar "${commandName}" sem permissão.`);
  }
  return allowed;
}

module.exports = { check, isOwner, isAdmin };
