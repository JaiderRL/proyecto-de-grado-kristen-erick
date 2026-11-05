'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const statusNames = { draft: 'Borrador', review: 'En revisión', published: 'Publicado', pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };
const state = { user: null, authMode: 'login', afterAuth: null, catalogPage: 1, dashboardPage: 1, tab: '', saved: new Set(), article: null, editor: null, editorSnapshot: '', review: null, catalogRequest: 0, dashboardRequest: 0, routeRequest: 0 };
let toastTimer;

async function request(path, { method = 'GET', body, ...options } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method, credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options,
    });
  } catch {
    throw new Error('No pudimos conectar. Comprueba tu conexión e inténtalo de nuevo.');
  }
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function message(selector, text = '', success = false) {
  const element = $(selector);
  element.textContent = text;
  element.classList.toggle('success', success);
}

function toast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
}

function date(value) {
  if (!value) return '';
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(parsed);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function empty(title, description, action = '') {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>${action}</div>`;
}

function button(action, label, id = '', secondary = true) {
  return `<button class="button small${secondary ? ' secondary' : ''}" data-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;
}

function paginate(selector, pagination, action) {
  const { total, limit, offset } = pagination;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  $(selector).innerHTML = pages <= 1 ? '' : `${page > 1 ? button(action, '← Anterior', page - 1) : ''}<span>Página ${page} de ${pages}</span>${page < pages ? button(action, 'Siguiente →', page + 1) : ''}`;
}

function card(post, style = 'article') {
  const visuals = { Privacidad: ['privacy', '◎'], Amenazas: ['threat', '⌁'], Herramientas: ['tools', '⌘'], 'Guía': ['guide', '↗'], 'IA y sociedad': ['ai', '✦'] };
  const [tone, symbol] = visuals[post.category] || ['guide', '◇'];
  const link = `/articulo/${encodeURIComponent(post.slug)}`;
  return `<article class="${style}-card"><div class="card-visual tone-${tone}" aria-hidden="true"><span>${symbol}</span><small>BYTEGUARD / ${escapeHtml(post.category.toUpperCase())}</small></div><div class="card-body"><div class="card-meta"><span class="category-tag">${escapeHtml(post.category)}</span><span>${post.readingMinutes} MIN DE LECTURA</span></div><h3><a href="${link}">${escapeHtml(post.title)}</a></h3>${style === 'compact' ? `<a class="text-link" href="${link}">Leer artículo ↗</a>` : `<p>${escapeHtml(post.excerpt)}</p><div class="card-footer"><span>${escapeHtml(post.author.name)} · ${date(post.publishedAt)}</span><a class="icon-button" href="${link}" aria-label="Leer ${escapeHtml(post.title)}">↗</a></div>`}</div></article>`;
}

async function loadFeatured() {
  try {
    const { posts } = await request('/api/posts?limit=4');
    $('#featuredPosts').innerHTML = posts.length ? card(posts[0], 'feature') + `<div class="side-articles">${posts.slice(1).map((post) => card(post, 'compact')).join('')}</div>` : empty('Pronto, nuevas ideas.', 'Las publicaciones aparecerán aquí cuando el equipo las apruebe.');
  } catch (error) {
    $('#featuredPosts').innerHTML = empty('No pudimos cargar las lecturas.', error.message, button('retry-home', 'Reintentar'));
  }
}

async function loadCategories() {
  try {
    const { categories } = await request('/api/posts/categories');
    const current = $('#categoryFilter').value;
    const names = [...new Set(['Seguridad', 'Privacidad', 'Amenazas', 'Guía', 'Herramientas', 'IA y sociedad', ...categories.map((category) => category.name)])];
    $('#categoryFilter').innerHTML = '<option value="">Todos los temas</option>' + names.map((name) => `<option>${escapeHtml(name)}</option>`).join('');
    $('#categoryFilter').value = current;
  } catch { /* The default filter remains available; the catalog displays network errors. */ }
}

async function loadCatalog() {
  const sequence = ++state.catalogRequest;
  const query = $('#searchInput').value.trim();
  const category = $('#categoryFilter').value;
  const params = new URLSearchParams({ limit: '6', offset: String((state.catalogPage - 1) * 6), sort: $('#sortFilter').value });
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  $('#clearFilters').hidden = !query && !category;
  $('#publicPosts').setAttribute('aria-busy', 'true');
  try {
    const { posts, pagination } = await request(`/api/posts?${params}`);
    if (sequence !== state.catalogRequest) return;
    $('#resultCount').textContent = `${pagination.total} ${pagination.total === 1 ? 'lectura' : 'lecturas'}${query ? ` para “${query}”` : ''}${category ? ` · ${category}` : ''}`;
    $('#publicPosts').innerHTML = posts.length ? posts.map((post) => card(post)).join('') : empty('Cada pregunta tiene su momento.', 'No encontramos artículos con estos filtros. Prueba otro tema o palabra.', button('clear-filters', 'Ver todas las lecturas'));
    paginate('#catalogPagination', pagination, 'catalog-page');
  } catch (error) {
    if (sequence !== state.catalogRequest) return;
    $('#publicPosts').innerHTML = empty('No pudimos cargar el catálogo.', error.message, button('retry-catalog', 'Reintentar'));
    $('#catalogPagination').innerHTML = '';
    $('#resultCount').textContent = 'Catálogo no disponible';
  } finally {
    if (sequence === state.catalogRequest) $('#publicPosts').setAttribute('aria-busy', 'false');
  }
}

function updateSession(user) {
  state.user = user;
  $('#accountButton').textContent = user ? 'Mi espacio ↗' : 'Acceso editorial ↗';
  if (user) {
    $('#userName').textContent = user.name;
    $('#userAvatar').textContent = initials(user.name);
    $('#userRole').textContent = user.role === 'admin' ? 'Administrador' : 'Escritor';
  } else {
    state.saved.clear();
  }
}

async function loadSaved() {
  if (!state.user) return [];
  const { posts } = await request('/api/community/bookmarks');
  state.saved = new Set(posts.map((post) => post.id));
  updateBookmark();
  return posts;
}

function updateBookmark() {
  const saved = state.saved.has(state.article?.id);
  $('#bookmarkButton').textContent = saved ? 'Guardado ✓' : 'Guardar lectura';
  $('#bookmarkButton').setAttribute('aria-pressed', String(saved));
}

function navigate(url) {
  history.pushState({}, '', url);
  renderRoute();
}

async function renderRoute() {
  const sequence = ++state.routeRequest;
  $('#mainNav').classList.remove('open');
  $('#menuButton').setAttribute('aria-expanded', 'false');
  const article = location.pathname.startsWith('/articulo/');
  const dashboard = !article && location.hash.startsWith('#panel');
  $('#homeView').hidden = article || dashboard;
  $('#articleView').hidden = !article;
  $('#dashboardView').hidden = !dashboard;
  document.title = 'ByteGuard — Ciberseguridad sin ruido';
  if (article) {
    window.scrollTo(0, 0);
    await loadArticle(location.pathname.split('/')[2], sequence);
  } else if (dashboard) {
    if (!state.user) {
      $('#dashboardView').hidden = true;
      $('#homeView').hidden = false;
      openAuth('login', () => renderRoute());
      return;
    }
    const tab = location.hash.split('/')[1] || (state.user.role === 'admin' ? 'review' : 'mine');
    setupDashboard(tab);
    await loadDashboard();
    window.scrollTo(0, 0);
  } else {
    if (!location.hash) window.scrollTo(0, 0);
    else document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }
}

async function loadArticle(slug, sequence) {
  state.article = null;
  $('#articleDetail').hidden = true;
  $('#articleLoading').hidden = false;
  $('#articleLoading').textContent = 'Cargando artículo…';
  try {
    const { post } = await request(`/api/posts/${encodeURIComponent(slug)}`);
    if (sequence !== state.routeRequest) return;
    state.article = post;
    document.title = `${post.title} — ByteGuard`;
    $('#articleTitle').textContent = post.title;
    $('#articleMeta').textContent = `${post.category.toUpperCase()} · ${post.readingMinutes} MIN DE LECTURA`;
    $('#articleExcerpt').textContent = post.excerpt;
    $('#articleAuthor').textContent = post.author.name;
    $('#articleAvatar').textContent = initials(post.author.name);
    $('#articleDate').textContent = `Publicado el ${date(post.publishedAt)}`;
    // This HTML is sanitized by the API, including legacy content.
    $('#articleContent').innerHTML = post.content;
    const headings = $$('#articleContent h2, #articleContent h3');
    $('#articleToc').innerHTML = headings.map((heading, index) => {
      heading.id = `seccion-${index + 1}`;
      return `<a href="#${heading.id}">${escapeHtml(heading.textContent)}</a>`;
    }).join('') || '<span>Una lectura para reflexionar.</span>';
    $('#commentForm').reset();
    message('#commentMessage');
    updateBookmark();
    $('#articleLoading').hidden = true;
    $('#articleDetail').hidden = false;
    await loadComments();
    const { posts } = await request(`/api/posts?category=${encodeURIComponent(post.category)}&limit=4`);
    if (sequence !== state.routeRequest) return;
    const related = posts.filter((item) => item.id !== post.id).slice(0, 3);
    $('#relatedPosts').innerHTML = related.length ? related.map((item) => card(item)).join('') : empty('La biblioteca sigue creciendo.', 'Explora otros temas en el catálogo.', '<a class="button small secondary" href="/#articulos">Explorar artículos →</a>');
  } catch (error) {
    if (sequence !== state.routeRequest) return;
    if (!state.article) {
      $('#articleLoading').textContent = error.status === 404 ? 'Esta lectura ya no está disponible o todavía no se ha publicado.' : error.message;
    } else toast(error.message);
  }
}

async function loadComments(page = 1) {
  const postId = state.article?.id;
  if (!postId) return;
  try {
    const { comments, pagination } = await request(`/api/community/posts/${postId}/comments?page=${page}`);
    if (state.article?.id !== postId) return;
    $('#commentsList').innerHTML = comments.map((comment) => `<article class="comment"><strong>${escapeHtml(comment.author)}</strong><small>${date(comment.createdAt)}</small><p>${escapeHtml(comment.content)}</p></article>`).join('') || '<p class="field-note">Todavía no hay comentarios publicados. Abre la conversación.</p>';
    paginate('#commentsPagination', pagination, 'comments-page');
  } catch (error) { $('#commentsList').textContent = error.message; }
}

function openAuth(mode = 'login', afterAuth = null) {
  state.afterAuth = afterAuth;
  setAuthMode(mode);
  if (!$('#authDialog').open) $('#authDialog').showModal();
  (mode === 'login' ? $('#authEmail') : $('#authName')).focus();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const creating = mode !== 'login';
  $('#authNameField').hidden = !creating;
  $('#authName').required = creating;
  $('#authName').disabled = !creating;
  $('#authPassword').autocomplete = creating ? 'new-password' : 'current-password';
  $('#authTitle').textContent = mode === 'setup' ? 'Hazlo tuyo.' : creating ? 'Tu perspectiva cuenta.' : 'Bienvenido de nuevo.';
  $('#authIntro').textContent = mode === 'setup' ? 'Crea la primera cuenta de administración de ByteGuard. Esta configuración se realiza una sola vez desde el equipo local.' : creating ? 'Crea tu cuenta de escritor. Comparte ideas, guarda lecturas y participa en la comunidad.' : 'Entra a tu espacio para escribir, guardar lecturas y participar.';
  $('#authSubmit').textContent = mode === 'setup' ? 'Crear administración →' : creating ? 'Crear cuenta de escritor →' : 'Iniciar sesión →';
  $('#authNote').textContent = creating ? 'Usa una contraseña única de al menos 8 caracteres (máximo 72 bytes).' : 'Tu cuenta determina si accedes como escritor o administrador.';
  $('#authSwitch').hidden = mode === 'setup';
  $('#authSwitch').textContent = creating ? 'Ya tengo cuenta. Iniciar sesión' : 'Crear una cuenta de escritor';
  message('#authMessage');
}

function setupDashboard(tab) {
  const admin = state.user.role === 'admin';
  const tabs = admin ? [['review', 'Revisión editorial'], ['posts', 'Publicaciones'], ['mine', 'Mis artículos'], ['users', 'Equipo'], ['comments', 'Comentarios'], ['saved', 'Lecturas guardadas']] : [['mine', 'Mis artículos'], ['saved', 'Lecturas guardadas']];
  if (!tabs.some(([key]) => key === tab)) tab = admin ? 'review' : 'mine';
  if (state.tab !== tab) {
    state.tab = tab;
    state.dashboardPage = 1;
    $('#dashboardFilter').innerHTML = tab === 'comments' ? '<option value="pending">Pendientes</option><option value="approved">Aprobados</option><option value="rejected">Rechazados</option>' : '<option value="all">Todos</option><option value="draft">Borradores</option><option value="review">En revisión</option><option value="published">Publicados</option>';
    $('#dashboardFilter').value = tab === 'review' ? 'review' : tab === 'comments' ? 'pending' : 'all';
  }
  $('#dashboardNav').innerHTML = tabs.map(([key, label]) => `<button data-action="dashboard-tab" data-id="${key}" class="${key === tab ? 'active' : ''}" ${key === tab ? 'aria-current="page"' : ''}>${label}</button>`).join('');
  $('#dashboardTitle').textContent = admin ? 'La sala de control.' : 'Tu mesa de trabajo.';
  $('#dashboardIntro').textContent = `Hola, ${state.user.name}. ${admin ? 'Cuida cada historia que llega a la comunidad.' : 'Tu próxima idea puede ayudar a alguien a navegar más seguro.'}`;
  $('#dashboardListTitle').textContent = tabs.find(([key]) => key === tab)[1];
  $('#dashboardFilterLabel').hidden = ['users', 'saved'].includes(tab);
}

function statCards(stats) {
  $('#dashboardStats').innerHTML = stats.map(([count, label]) => `<div><strong>${count}</strong><p>${label}</p></div>`).join('');
}

function postRow(post) {
  const admin = state.user.role === 'admin';
  let actions = '';
  if (post.status === 'published') {
    actions += `<a class="button small secondary" href="/articulo/${post.slug}">Leer ↗</a>`;
    if (admin) actions += button('review-post', 'Gestionar', post.id) + button('feature-post', post.featured ? 'Quitar destacado' : 'Destacar', `${post.id}:${post.featured ? '0' : '1'}`);
  } else {
    actions += button('edit-post', 'Editar', post.id);
    if (admin && post.status === 'review') actions += button('review-post', 'Revisar →', post.id, false);
    if (post.status === 'draft') actions += button('delete-post', 'Eliminar', post.id);
  }
  return `<article class="post-row"><div><span class="status-badge status-${post.status}">${statusNames[post.status]}</span>${post.featured ? ' <span class="status-badge">Destacado</span>' : ''}<h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.author.name)} · ${escapeHtml(post.category)} · ${date(post.updatedAt)}</p>${post.reviewNote && post.status === 'draft' ? `<p><strong>Observaciones:</strong> ${escapeHtml(post.reviewNote)}</p>` : ''}</div><div class="row-actions">${actions}</div></article>`;
}

async function loadDashboard() {
  if (!state.user) return;
  const sequence = ++state.dashboardRequest;
  const tab = state.tab;
  const admin = state.user.role === 'admin';
  const offset = (state.dashboardPage - 1) * 10;
  const status = $('#dashboardFilter').value;
  $('#dashboardContent').setAttribute('aria-busy', 'true');
  try {
    const stats = await request(admin ? '/api/admin/stats' : '/api/posts/mine?limit=1');
    if (sequence !== state.dashboardRequest) return;
    if (admin) statCards([[stats.pendingPosts, 'Pendientes de revisión'], [stats.publishedPosts, 'Artículos publicados'], [stats.writerCount, 'Escritores registrados']]);
    else {
      const counts = Object.fromEntries(stats.stats.map((item) => [item.status, item.total]));
      statCards([[counts.draft || 0, 'Borradores'], [counts.review || 0, 'En revisión'], [counts.published || 0, 'Publicados']]);
    }
    let html;
    let pagination;
    if (tab === 'saved') {
      const posts = await loadSaved();
      html = posts.length ? `<div class="article-grid">${posts.slice(offset, offset + 10).map((post) => card(post)).join('')}</div>` : empty('Guarda las ideas que te acompañan.', 'Abre un artículo y pulsa “Guardar lectura” para encontrarlo aquí.', '<a class="button small secondary" href="/#articulos">Explorar artículos →</a>');
      pagination = { total: posts.length, limit: 10, offset };
    } else if (tab === 'users') {
      const data = await request(`/api/admin/users?limit=10&offset=${offset}`);
      pagination = data.pagination;
      html = data.users.map((user) => `<article class="post-row"><div><span class="status-badge ${user.active ? 'status-published' : 'status-rejected'}">${user.active ? 'Activa' : 'Suspendida'} · ${user.role === 'admin' ? 'Administrador' : 'Escritor'}</span><h3>${escapeHtml(user.name)}</h3><p>${escapeHtml(user.email)} · ${user.postCount} artículos</p></div><div class="row-actions">${user.role === 'writer' ? button('toggle-user', user.active ? 'Suspender cuenta' : 'Activar cuenta', `${user.id}:${user.active ? '0' : '1'}`) : ''}</div></article>`).join('');
    } else if (tab === 'comments') {
      const data = await request(`/api/admin/comments?status=${status}&limit=10&offset=${offset}`);
      pagination = data.pagination;
      html = data.comments.map((comment) => `<article class="post-row"><div><span class="status-badge status-${comment.status}">${statusNames[comment.status]}</span><h3>${escapeHtml(comment.author)}</h3><p>En ${escapeHtml(comment.postTitle)} · ${date(comment.createdAt)}</p><p>${escapeHtml(comment.content)}</p></div><div class="row-actions">${comment.status !== 'approved' ? button('moderate-comment', 'Aprobar', `${comment.id}:approved`, false) : ''}${comment.status !== 'rejected' ? button('moderate-comment', 'Rechazar', `${comment.id}:rejected`) : ''}</div></article>`).join('') || empty('Todo al día.', 'No hay comentarios en este estado.');
    } else {
      const data = await request(`${tab === 'mine' ? '/api/posts/mine' : '/api/admin/posts'}?status=${status}&limit=10&offset=${offset}`);
      pagination = data.pagination;
      html = data.posts.map(postRow).join('') || empty(tab === 'review' ? 'La bandeja está al día.' : 'Aquí empieza tu próxima historia.', tab === 'review' ? 'Los artículos enviados por los escritores aparecerán aquí.' : 'Todavía no hay artículos en este estado.', button('new-post', 'Crear un artículo'));
    }
    if (sequence !== state.dashboardRequest) return;
    if (!html && state.dashboardPage > 1) { state.dashboardPage -= 1; return loadDashboard(); }
    $('#dashboardContent').innerHTML = html;
    paginate('#dashboardPagination', pagination, 'dashboard-page');
  } catch (error) {
    if (sequence !== state.dashboardRequest) return;
    $('#dashboardContent').innerHTML = empty('No pudimos abrir tu espacio.', error.message, button(error.status === 401 ? 'login-again' : 'retry-dashboard', error.status === 401 ? 'Iniciar sesión' : 'Reintentar'));
    $('#dashboardPagination').innerHTML = '';
  } finally {
    if (sequence === state.dashboardRequest) $('#dashboardContent').setAttribute('aria-busy', 'false');
  }
}

function editorPayload() {
  return { title: $('#postTitle').value.trim(), excerpt: $('#postExcerpt').value.trim(), category: $('#postCategory').value, content: $('#postContent').value, contentFormat: $('#postFormat').value };
}

function editorDirty() {
  return $('#editorDialog').open && JSON.stringify(editorPayload()) !== state.editorSnapshot;
}

function updateEditor() {
  const words = $('#postContent').value.trim().split(/\s+/).filter(Boolean).length;
  $('#wordCount').textContent = `${words} palabras · ${Math.max(1, Math.ceil(words / 220))} min`;
  $('#saveState').textContent = editorDirty() ? 'Cambios pendientes de guardar.' : 'Todos los cambios están guardados.';
  $('.format-toolbar').hidden = $('#postFormat').value !== 'markdown';
}

function openEditor(post = null) {
  if (!state.user) return openAuth('login', () => openEditor(post));
  state.editor = post;
  $('#editorForm').reset();
  message('#editorMessage');
  $('#editorTitle').textContent = post ? 'Dale forma a tu historia.' : 'Una idea. Muchas posibilidades.';
  $('#postTitle').value = post?.title || '';
  $('#postExcerpt').value = post?.excerpt || '';
  if (post && ![...$('#postCategory').options].some((option) => option.value === post.category)) $('#postCategory').add(new Option(post.category, post.category));
  $('#postCategory').value = post?.category || 'Seguridad';
  $('#postContent').value = post?.contentSource || post?.content || '';
  $('#postFormat').value = post?.contentFormat || 'markdown';
  $('#editorReviewNote').hidden = !post?.reviewNote;
  $('#editorReviewNote').textContent = post?.reviewNote ? `Observaciones de revisión: ${post.reviewNote}` : '';
  state.editorSnapshot = JSON.stringify(editorPayload());
  showEditorWrite();
  $('#editorDialog').showModal();
  updateEditor();
  $('#postTitle').focus();
}

function showEditorWrite() {
  $('#editorInput').hidden = false;
  $('#editorPreview').hidden = true;
  $('#writeTab').classList.add('active');
  $('#previewTab').classList.remove('active');
}

async function previewEditor() {
  message('#editorMessage');
  const { content } = await request('/api/posts/preview', { method: 'POST', body: editorPayload() });
  $('#editorPreview').innerHTML = content;
  $('#editorInput').hidden = true;
  $('#editorPreview').hidden = false;
  $('#writeTab').classList.remove('active');
  $('#previewTab').classList.add('active');
}

function insertFormat(format) {
  const field = $('#postContent');
  const selected = field.value.slice(field.selectionStart, field.selectionEnd) || 'Tu texto';
  const snippets = { heading: `\n## ${selected}\n`, bold: `**${selected}**`, italic: `*${selected}*`, list: `\n- ${selected}\n- Otro elemento\n`, link: `[${selected}](https://ejemplo.com)`, code: `\n\x60\x60\x60\n${selected}\n\x60\x60\x60\n`, quote: `\n> ${selected}\n` };
  field.setRangeText(snippets[format], field.selectionStart, field.selectionEnd, 'select');
  field.focus();
  updateEditor();
}

function confirmAction(text) {
  return new Promise((resolve) => {
    const dialog = $('#confirmDialog');
    $('#confirmText').textContent = text;
    dialog.returnValue = 'no';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    dialog.showModal();
    $('[data-confirm="no"]').focus();
  });
}

async function closeDialog(dialog) {
  if (dialog.id === 'editorDialog' && editorDirty() && !await confirmAction('Tienes cambios sin guardar. Si cierras el editor, se perderán estos cambios.')) return;
  dialog.close();
}

async function openReview(id) {
  const data = await request(`/api/admin/posts/${id}`);
  state.review = data.post;
  $('#reviewTitle').textContent = data.post.title;
  $('#reviewMeta').textContent = `${statusNames[data.post.status].toUpperCase()} · ${data.post.author.name} · ${data.post.readingMinutes} MIN`;
  $('#reviewExcerpt').textContent = data.post.excerpt;
  $('#reviewContent').innerHTML = data.post.content;
  $('#reviewHistory').innerHTML = data.events.map((event) => `<p><strong>${escapeHtml(event.action)}</strong><small>${escapeHtml(event.actor || 'Equipo ByteGuard')} · ${date(event.createdAt)}</small>${escapeHtml(event.note)}</p>`).join('') || '<p>Artículo anterior al registro de historial.</p>';
  $('#reviewNote').value = '';
  $('#publishPostButton').hidden = data.post.status !== 'review';
  $('#reviewActions').hidden = data.post.status === 'draft';
  $('#returnPostButton').textContent = data.post.status === 'published' ? 'Retirar publicación' : 'Devolver a borrador';
  message('#reviewMessage');
  $('#reviewDialog').showModal();
}

async function reviewAction(publish) {
  try {
    const post = state.review;
    if (!post) return;
    if (publish && !await confirmAction(`“${post.title}” será visible para todas las personas. ¿Publicar?`)) return;
    await request(`/api/admin/posts/${post.id}/${publish ? 'publish' : 'return'}`, { method: 'PATCH', body: { version: post.version, note: $('#reviewNote').value } });
    $('#reviewDialog').close();
    toast(publish ? 'Artículo publicado. Ya está disponible en el blog.' : 'Artículo devuelto a borrador con tus observaciones.');
    await Promise.all([loadDashboard(), loadFeatured(), loadCatalog(), loadCategories()]);
  } catch (error) { message('#reviewMessage', error.message); }
}

const info = {
  about: ['Ciberseguridad sin ruido.', '<p>ByteGuard es un espacio editorial en español para aprender a cuidar nuestra vida digital. Publicamos guías, explicaciones y reflexiones sobre seguridad, privacidad y tecnología.</p><h3>Conocimiento que se comparte</h3><p>Cualquier persona puede crear una cuenta de escritor y proponer una lectura. El equipo de administración revisa cada artículo antes de publicarlo.</p><p>Valoramos las fuentes, las explicaciones claras y las conversaciones respetuosas.</p>'],
  guidelines: ['Escribe con criterio.', '<ol><li><strong>Parte de una pregunta.</strong> Explica a quién ayudas y qué aprenderá.</li><li><strong>Organiza la lectura.</strong> Usa subtítulos, ejemplos y pasos concretos.</li><li><strong>Comprueba tus fuentes.</strong> Enlaza documentación original y distingue hechos de opiniones.</li><li><strong>Cuida la privacidad.</strong> No publiques credenciales ni datos de otras personas.</li><li><strong>Practica con permiso.</strong> Las demostraciones de seguridad deben usar entornos propios o autorizados.</li></ol><h3>Del borrador a la comunidad</h3><p>Guarda tu trabajo y consulta la vista previa. Cuando esté listo, envíalo a revisión. Administración puede publicarlo o devolverlo con observaciones. Si un artículo publicado necesita cambios, administración lo retira a borrador para iniciar otra revisión.</p>'],
  privacy: ['Tus datos, con claridad.', '<p>ByteGuard guarda el nombre, correo y contraseña protegida de tu cuenta, tus artículos, lecturas guardadas y comentarios. El nombre de autor y los comentarios aprobados son públicos. Tu correo solo aparece en tu cuenta y en la administración.</p><p>La cookie de sesión permite mantener tu acceso. No usamos servicios de analítica ni fuentes externas en la interfaz. Al cerrar sesión, el acceso se invalida en el servidor.</p><p>La lista personal de seguridad guarda únicamente casillas marcadas en este navegador. Las cuentas y el contenido se guardan en el servidor.</p><p>Para solicitar la eliminación de una cuenta o contenido, comunícate con la persona responsable de esta instalación. El cambio de contraseña está disponible en “Mi perfil y contraseña”.</p>'],
};

function openInfo(key) {
  $('#infoTitle').textContent = info[key][0];
  $('#infoContent').innerHTML = info[key][1];
  $('#infoDialog').showModal();
}

function openChecklist() {
  const items = ['Reviso las opciones de recuperación de mis cuentas principales.', 'Uso contraseñas únicas y un gestor de contraseñas.', 'Activo autenticación multifactor donde esté disponible.', 'Mantengo el sistema y las aplicaciones actualizados.', 'Verifico enlaces y solicitudes urgentes por otro canal.', 'Guardo copias de seguridad y compruebo que puedo restaurarlas.'];
  let checked = [];
  try { checked = JSON.parse(localStorage.getItem('byteguard-checklist') || '[]'); } catch { /* Optional browser preference. */ }
  $('#infoTitle').textContent = 'Tu lista de seguridad personal.';
  $('#infoContent').innerHTML = '<p>Una guía de hábitos para revisar con calma. Tu progreso se guarda solo en este navegador.</p>' + items.map((item, index) => `<label class="checklist-item"><input type="checkbox" data-checklist="${index}" ${Array.isArray(checked) && checked.includes(index) ? 'checked' : ''} /><span>${item}</span></label>`).join('');
  $('#infoDialog').showModal();
}

async function handleAction(action, id, target) {
  switch (action) {
    case 'account': return state.user ? navigate('/#panel') : openAuth();
    case 'setup': return openAuth('setup');
    case 'write': return state.user ? openEditor() : openAuth('register', () => { navigate('/#panel/mine'); openEditor(); });
    case 'new-post': return openEditor();
    case 'login-again': return openAuth('login', () => loadDashboard());
    case 'auth-switch': return setAuthMode(state.authMode === 'login' ? 'register' : 'login');
    case 'show-password': {
      const show = $('#authPassword').type === 'password';
      $('#authPassword').type = show ? 'text' : 'password';
      target.textContent = show ? 'Ocultar' : 'Ver';
      target.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      return;
    }
    case 'logout':
      try { await request('/api/auth/logout', { method: 'POST', body: {} }); } catch (error) { if (error.status !== 401) throw error; }
      updateSession(null);
      state.tab = '';
      navigate('/');
      return toast('Sesión cerrada. Hasta la próxima lectura.');
    case 'saved': return state.user ? navigate('/#panel/saved') : openAuth('login', () => navigate('/#panel/saved'));
    case 'dashboard-tab': return navigate(`/#panel/${id}`);
    case 'dashboard-page': state.dashboardPage = Number(id); return loadDashboard();
    case 'catalog-page': state.catalogPage = Number(id); await loadCatalog(); return $('#articulos').scrollIntoView();
    case 'comments-page': return loadComments(Number(id));
    case 'retry-home': return Promise.all([loadFeatured(), loadCatalog()]);
    case 'retry-catalog': return loadCatalog();
    case 'retry-dashboard': return loadDashboard();
    case 'clear-filters':
      $('#searchInput').value = ''; $('#categoryFilter').value = ''; state.catalogPage = 1;
      return loadCatalog();
    case 'edit-post': {
      const data = await request(state.user.role === 'admin' ? `/api/admin/posts/${id}` : `/api/posts/mine/${id}`);
      return openEditor(data.post);
    }
    case 'delete-post':
      if (!await confirmAction('Se eliminará este borrador y su historial. Esta acción no se puede deshacer.')) return;
      await request(`/api/posts/${id}`, { method: 'DELETE' });
      toast('Borrador eliminado.');
      return loadDashboard();
    case 'review-post': return openReview(id);
    case 'publish-post': return reviewAction(true);
    case 'return-post': return reviewAction(false);
    case 'feature-post': {
      const [postId, featured] = id.split(':');
      await request(`/api/admin/posts/${postId}/feature`, { method: 'PATCH', body: { featured: featured === '1' } });
      toast('Selección de portada actualizada.');
      return Promise.all([loadDashboard(), loadFeatured(), loadCatalog()]);
    }
    case 'toggle-user': {
      const [userId, active] = id.split(':');
      if (!await confirmAction(active === '1' ? 'La cuenta volverá a poder iniciar sesión.' : 'Se suspenderá el acceso de esta cuenta y se cerrarán sus sesiones. Sus artículos se conservarán.')) return;
      const data = await request(`/api/admin/users/${userId}`, { method: 'PATCH', body: { active: active === '1' } });
      toast(data.message);
      return loadDashboard();
    }
    case 'moderate-comment': {
      const [commentId, status] = id.split(':');
      await request(`/api/admin/comments/${commentId}`, { method: 'PATCH', body: { status } });
      toast('Comentario moderado.');
      return loadDashboard();
    }
    case 'editor-write': return showEditorWrite();
    case 'editor-preview':
      try { await previewEditor(); } catch (error) { message('#editorMessage', error.message); }
      return;
    case 'bookmark': {
      if (!state.user) return openAuth('login', () => handleAction('bookmark'));
      if (!state.article) return;
      const postId = state.article.id;
      const saved = state.saved.has(postId);
      await request(`/api/community/bookmarks/${postId}`, { method: saved ? 'DELETE' : 'PUT', body: {} });
      if (saved) state.saved.delete(postId); else state.saved.add(postId);
      updateBookmark();
      return toast(saved ? 'Lectura retirada de tus guardados.' : 'Lectura guardada en tu espacio.');
    }
    case 'share':
      try { await navigator.clipboard.writeText(`${location.origin}/articulo/${state.article.slug}`); toast('Enlace copiado. Comparte el conocimiento.'); }
      catch { toast(`Enlace del artículo: ${location.origin}/articulo/${state.article.slug}`); }
      return;
    case 'profile':
      $('#profileName').value = state.user.name;
      $('#profileBio').value = state.user.bio || '';
      $('#profileEmail').textContent = state.user.email;
      $('#passwordForm').reset();
      message('#profileMessage'); message('#passwordMessage');
      return $('#profileDialog').showModal();
    case 'checklist': return openChecklist();
    case 'about': case 'guidelines': case 'privacy': return openInfo(action);
  }
}

document.addEventListener('click', async (event) => {
  const close = event.target.closest('[data-close]');
  if (close) return closeDialog(close.closest('dialog'));
  const confirm = event.target.closest('[data-confirm]');
  if (confirm) return $('#confirmDialog').close(confirm.dataset.confirm);
  const format = event.target.closest('[data-format]');
  if (format) return insertFormat(format.dataset.format);
  const category = event.target.closest('[data-category]');
  if (category) {
    $('#categoryFilter').value = category.dataset.category;
    $('#searchInput').value = ''; state.catalogPage = 1;
    navigate('/#articulos');
    return loadCatalog();
  }
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.disabled) return;
    action.disabled = true;
    try { await handleAction(action.dataset.action, action.dataset.id, action); }
    catch (error) { toast(error.message); }
    finally { action.disabled = false; }
    return;
  }
  const link = event.target.closest('a');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const url = new URL(link.href);
  if (url.origin === location.origin && (url.pathname === '/' || url.pathname.startsWith('/articulo/'))) {
    if (url.pathname === location.pathname && url.hash.startsWith('#seccion-')) return;
    if (url.hash === '#main') return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  }
});

$$('dialog').forEach((dialog) => {
  dialog.addEventListener('cancel', (event) => {
    if (dialog.id === 'editorDialog') { event.preventDefault(); closeDialog(dialog); }
  });
});

$('#menuButton').addEventListener('click', () => {
  const open = $('#mainNav').classList.toggle('open');
  $('#menuButton').setAttribute('aria-expanded', String(open));
});

$('#searchForm').addEventListener('submit', (event) => { event.preventDefault(); state.catalogPage = 1; loadCatalog(); });
$('#categoryFilter').addEventListener('change', () => { state.catalogPage = 1; loadCatalog(); });
$('#sortFilter').addEventListener('change', () => { state.catalogPage = 1; loadCatalog(); });
$('#dashboardFilter').addEventListener('change', () => { state.dashboardPage = 1; loadDashboard(); });
$('#editorForm').addEventListener('input', updateEditor);
$('#editorForm').addEventListener('change', updateEditor);
window.addEventListener('beforeunload', (event) => { if (editorDirty()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('popstate', () => { if (!location.hash.startsWith('#seccion-')) renderRoute(); });

$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = $('#authSubmit');
  submit.disabled = true;
  message('#authMessage');
  try {
    const endpoint = state.authMode === 'setup' ? '/api/setup' : `/api/auth/${state.authMode}`;
    const data = await request(endpoint, { method: 'POST', body: { name: $('#authName').value.trim(), email: $('#authEmail').value.trim(), password: $('#authPassword').value } });
    updateSession(data.user);
    if (state.authMode === 'setup') $('#setupBanner').hidden = true;
    $('#authDialog').close();
    $('#authForm').reset();
    try { await loadSaved(); } catch (error) { toast(error.message); }
    const after = state.afterAuth;
    state.afterAuth = null;
    if (after) await after(); else navigate('/#panel');
  } catch (error) { message('#authMessage', error.message); }
  finally { submit.disabled = false; }
});

$('#editorForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = event.submitter?.value || 'draft';
  const buttons = $$('#editorForm button[type="submit"]');
  buttons.forEach((element) => { element.disabled = true; });
  message('#editorMessage');
  try {
    const data = await request(state.editor ? `/api/posts/${state.editor.id}` : '/api/posts', { method: state.editor ? 'PATCH' : 'POST', body: { ...editorPayload(), status, ...(state.editor ? { version: state.editor.version } : {}) } });
    state.editor = data.post;
    state.editorSnapshot = JSON.stringify(editorPayload());
    updateEditor();
    message('#editorMessage', status === 'draft' ? 'Borrador guardado. Puedes seguir escribiendo.' : 'Artículo enviado a revisión.', true);
    if (status === 'review') {
      $('#editorDialog').close();
      toast('Artículo enviado. Administración lo revisará antes de publicarlo.');
      navigate('/#panel/mine');
    } else if (!$('#dashboardView').hidden) await loadDashboard();
  } catch (error) { message('#editorMessage', error.message); }
  finally { buttons.forEach((element) => { element.disabled = false; }); }
});

function handleForm(selector, messageSelector, handler) {
  $(selector).addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    message(messageSelector);
    try { await handler(); }
    catch (error) { message(messageSelector, error.message); }
    finally { submit.disabled = false; }
  });
}

handleForm('#commentForm', '#commentMessage', async () => {
  if (!state.user) { openAuth('login', () => message('#commentMessage', 'Ya puedes enviar tu comentario.', true)); return; }
  const data = await request(`/api/community/posts/${state.article.id}/comments`, { method: 'POST', body: { content: $('#commentContent').value } });
  $('#commentForm').reset();
  message('#commentMessage', data.message, true);
});
handleForm('#profileForm', '#profileMessage', async () => {
  const data = await request('/api/auth/profile', { method: 'PATCH', body: { name: $('#profileName').value, bio: $('#profileBio').value } });
  updateSession(data.user);
  message('#profileMessage', 'Tu perfil está actualizado.', true);
  if (!$('#dashboardView').hidden) { setupDashboard(state.tab); await loadDashboard(); }
});
handleForm('#passwordForm', '#passwordMessage', async () => {
  const data = await request('/api/auth/password', { method: 'PATCH', body: { currentPassword: $('#currentPassword').value, password: $('#newPassword').value } });
  $('#passwordForm').reset();
  message('#passwordMessage', data.message, true);
});

document.addEventListener('change', (event) => {
  if (!event.target.matches('[data-checklist]')) return;
  try { localStorage.setItem('byteguard-checklist', JSON.stringify($$('[data-checklist]:checked').map((element) => Number(element.dataset.checklist)))); }
  catch { toast('Este navegador no permite guardar el progreso de la lista.'); }
});

async function init() {
  $('#year').textContent = new Date().getFullYear();
  const session = request('/api/auth/me').then(({ user }) => updateSession(user)).catch((error) => { if (error.status !== 401) toast(error.message); });
  await Promise.all([session, loadFeatured(), loadCategories(), loadCatalog()]);
  if (state.user) { try { await loadSaved(); } catch (error) { toast(error.message); } }
  try {
    const setup = await request('/api/setup');
    $('#setupBanner').hidden = !setup.required || !setup.allowed;
  } catch { /* The rest of the site remains usable. */ }
  await renderRoute();
}
init();
