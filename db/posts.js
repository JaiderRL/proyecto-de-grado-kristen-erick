const postColumns = `
  p.id,
  p.author_id AS author_id,
  COALESCE(u.name, p.author_name) AS author_name,
  p.title,
  p.slug,
  p.excerpt,
  p.content,
  p.category,
  p.reading_minutes,
  p.status,
  p.published_at,
  p.created_at,
  p.updated_at
  , p.source_content, p.content_format, p.review_note, p.version, p.featured
`;

const postJoin = 'FROM posts p LEFT JOIN users u ON u.id = p.author_id';

function findPostById(db, id) {
  return db.prepare(`SELECT ${postColumns} ${postJoin} WHERE p.id = ?`).get(id);
}

function formatPost(post, { includeContent = true, editorial = false } = {}) {
  if (!post) return null;

  const result = {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    readingMinutes: post.reading_minutes,
    status: post.status,
    author: {
      id: post.author_id,
      name: post.author_name
    },
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    publishedAt: post.published_at,
    featured: Boolean(post.featured)
  };

  if (includeContent) result.content = post.content;
  if (editorial) {
    if (includeContent) result.contentSource = post.source_content || post.content;
    result.contentFormat = post.content_format;
    result.reviewNote = post.review_note;
    result.version = post.version;
  }
  return result;
}

module.exports = { findPostById, formatPost, postColumns, postJoin };
