const en = require('./en.json');
const pt = require('./pt.json');

const translations = { en, pt };

function normalizeLanguage(q) {
  if (!q) return 'pt';
  const s = String(q).toLowerCase();
  if (s === 'english' || s === 'en' || s === 'eng') return 'en';
  if (s === 'pt' || s === 'pt-br' || s === 'portuguese' || s === 'br' || s === 'pt-br') return 'pt';
  return 'pt';
}

function t(lang, key, params) {
  const catalog = translations[lang] || translations['pt'];
  let txt = (catalog && catalog[key]) || key;
  if (!params) return txt;
  return txt.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? `{${k}}` : params[k]));
}

module.exports = { normalizeLanguage, t };
