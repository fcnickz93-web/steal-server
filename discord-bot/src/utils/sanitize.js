function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>@&]/g, (char) => {
      const map = { '<': '&lt;', '>': '&gt;', '@': '(at)', '&': '&amp;' };
      return map[char];
    })
    .trim()
    .slice(0, 2000);
}

function sanitizeArgs(args) {
  if (!Array.isArray(args)) return [];
  return args.map((arg) => (typeof arg === 'string' ? arg.trim().slice(0, 500) : ''));
}

function isValidInvite(input) {
  return /^(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9-]+$/.test(input.trim());
}

function isValidTemplate(input) {
  return /^(https?:\/\/)?(www\.)?discord\.new\/[a-zA-Z0-9]+$/.test(input.trim()) ||
    /^[a-zA-Z0-9]{8,}$/.test(input.trim());
}

function extractInviteCode(input) {
  const match = input.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : input.trim();
}

function extractTemplateCode(input) {
  const match = input.match(/discord\.new\/([a-zA-Z0-9]+)/);
  return match ? match[1] : input.trim();
}

module.exports = {
  sanitizeText,
  sanitizeArgs,
  isValidInvite,
  isValidTemplate,
  extractInviteCode,
  extractTemplateCode,
};
