const { FilterXSS } = require('xss');
const markdown = require('markdown-it')({ html: false, linkify: true, breaks: true });
markdown.disable('image');

const MAX_CONTENT_LENGTH = 50000;
const MAX_EXCERPT_LENGTH = 500;
const MAX_NAME_LENGTH = 80;
const MAX_TITLE_LENGTH = 160;

const stripAllMarkup = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'textarea', 'title']
});

const safeArticleMarkup = new FilterXSS({
  whiteList: {
    a: ['href', 'title'],
    b: [],
    blockquote: [],
    br: [],
    code: [],
    em: [],
    h2: [],
    h3: [],
    h1: [],
    h4: [],
    hr: [],
    s: [],
    table: [],
    thead: [],
    tbody: [],
    tr: [],
    th: [],
    td: [],
    i: [],
    li: [],
    ol: [],
    p: [],
    pre: [],
    strong: [],
    ul: []
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'textarea', 'title', 'iframe', 'object', 'svg', 'math']
});

function stripMarkup(value) {
  return stripAllMarkup.process(String(value || ''));
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = normalizeWhitespace(stripMarkup(value));
  if (!cleaned || cleaned.length > maxLength) return null;
  return cleaned;
}

function cleanName(value) {
  return cleanText(value, MAX_NAME_LENGTH);
}

function cleanTitle(value) {
  return cleanText(value, MAX_TITLE_LENGTH);
}

function cleanExcerpt(value) {
  return cleanText(value, MAX_EXCERPT_LENGTH);
}

function cleanCategory(value) {
  return cleanText(value, 50);
}

function cleanContent(value) {
  if (typeof value !== 'string' || value.length > MAX_CONTENT_LENGTH) return null;

  const cleaned = safeArticleMarkup.process(value).trim();

  const plainText = normalizeWhitespace(stripMarkup(cleaned));
  if (plainText.length < 20 || plainText.length > MAX_CONTENT_LENGTH) return null;
  return cleaned;
}

function renderContent(source, format = 'html') {
  if (typeof source !== 'string' || source.length > MAX_CONTENT_LENGTH) return null;
  if (!['html', 'markdown'].includes(format)) return null;
  return cleanContent(format === 'markdown' ? markdown.render(source) : source);
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validPassword(value) {
  if (typeof value !== 'string') return false;
  const byteLength = Buffer.byteLength(value, 'utf8');
  return byteLength >= 8 && byteLength <= 72 && /\S/.test(value);
}

function readingMinutes(content) {
  const words = normalizeWhitespace(stripMarkup(content)).split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);

  return slug || 'articulo';
}

function uniqueSlug(db, title) {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  const findBySlug = db.prepare('SELECT id FROM posts WHERE slug = ?');

  while (findBySlug.get(candidate)) {
    candidate = `${base.slice(0, 140)}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function toPositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

module.exports = {
  cleanCategory,
  cleanContent,
  cleanExcerpt,
  cleanName,
  cleanText,
  cleanTitle,
  MAX_CONTENT_LENGTH,
  normalizeEmail,
  readingMinutes,
  renderContent,
  slugify,
  toPositiveInteger,
  uniqueSlug,
  validPassword
};
