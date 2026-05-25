/**
 * Liberfy LinkedIn Automation — Dashboard App
 * Single JS module that powers all three dashboard pages.
 * Uses the Cloudflare Workers API (configured via WORKER_URL).
 */

'use strict';

// ── Configuration ─────────────────────────────────────────
const CONFIG = {
  // Replace with your actual Cloudflare Worker URL after deployment
  WORKER_URL: localStorage.getItem('worker_url') || 'https://liberfy-linkedin.YOUR_SUBDOMAIN.workers.dev',
  DASHBOARD_SECRET: localStorage.getItem('dashboard_secret') || '',
  LINKEDIN_NAME: 'Alberto López',
  LINKEDIN_TITLE: 'Gestor contable y fiscal · Liberfy',
};

// Sector display names
const SECTOR_LABELS = {
  ecommerce:         '🛒 E-commerce',
  content_creator:   '📱 Creadores',
  inmobiliario:      '🏠 Inmobiliario',
  iva_irpf:          '📊 IVA / IRPF',
  autonomos:         '👷 Autónomos',
  pymes:             '🏢 Pymes',
  normativa_europea: '🇪🇺 UE',
  general:           '📋 General',
};

// ── App State ─────────────────────────────────────────────
const State = {
  posts: [],
  filteredPosts: [],
  stats: null,
  analytics: null,
  currentFilter: 'all',
  currentUrgency: 'all',
  searchQuery: '',
  selectedPosts: new Set(),
  currentPage: 1,
  currentPreviewPostId: null,
};

// ── API Client ─────────────────────────────────────────────
const API = {
  async request(path, options = {}) {
    const url = `${CONFIG.WORKER_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.DASHBOARD_SECRET}`,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  getPosts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.request(`/api/posts${qs ? '?' + qs : ''}`);
  },

  getPost: (id) => API.request(`/api/posts/${id}`),

  approvePost: (id, editedContent) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'approve', content_edited: editedContent || null }),
  }),

  rejectPost: (id) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'reject' }),
  }),

  schedulePost: (id, scheduledAt) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'schedule', scheduled_at: scheduledAt }),
  }),

  publishPost: (id) => API.request(`/api/publish/${id}`, { method: 'POST' }),

  recordFeedback: (data) => API.request('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getStats: () => API.request('/api/stats'),

  // For triggering manual scraping runs via GitHub Actions API
  triggerWorkflow: (workflow) => {
    const token = localStorage.getItem('github_token') || '';
    const repo  = localStorage.getItem('github_repo') || '';
    if (!token || !repo) { Toast.show('Configura el token de GitHub en Configuración', 'error'); return; }
    return fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
    });
  },
};

// ── Toast Notifications ────────────────────────────────────
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
};

// ── Rendering Helpers ──────────────────────────────────────
function renderConfidenceMeter(score) {
  // score: 0-1
  const pct = Math.round(score * 100);
  const cls = pct < 40 ? 'low' : pct < 75 ? 'medium' : 'high';
  const label = pct < 40 ? `${pct}% confianza` : pct < 75 ? `${pct}% — aprendiendo` : `${pct}% — casi listo`;
  return `
    <div class="confidence-meter">
      <div class="confidence-bar">
        <div class="confidence-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="confidence-label">${label}</span>
    </div>`;
}

function renderHashtags(hashtagsStr) {
  try {
    const tags = JSON.parse(hashtagsStr || '[]');
    return tags.map(t => `<span class="hashtag-chip">${t}</span>`).join('');
  } catch {
    return '';
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function renderSectorBadge(sector) {
  return `<span class="sector-badge">${SECTOR_LABELS[sector] || sector}</span>`;
}

function renderTypeBadge(type) {
  return `<span class="post-type-badge ${type}">${type === 'normativa' ? '📋 Normativa' : '📰 Actualidad'}</span>`;
}

function renderUrgencyBadge(urgency) {
  const icons = { alta: '🔴', media: '🟡', baja: '⚪' };
  return `<span class="urgency-badge ${urgency}">${icons[urgency] || '⚪'} ${urgency}</span>`;
}

function renderStatusPill(status) {
  const labels = {
    published: '✅ Publicado',
    pending: '⏳ Pendiente',
    rejected: '❌ Rechazado',
    scheduled: '📅 Programado',
    approved: '👍 Aprobado',
  };
  return `<span class="status-pill ${status}">${labels[status] || status}</span>`;
}

// ── Post Card Renderer ─────────────────────────────────────
function renderPostCard(post) {
  const card = document.createElement('div');
  card.className = `post-card urgency-${post.urgency}`;
  card.id = `post-card-${post.id}`;
  card.dataset.type = post.type;
  card.dataset.urgency = post.urgency;
  card.dataset.id = post.id;

  const previewText = (post.content || '').replace(/</g, '&lt;');
  const confidence = post.confidence_score || 0;
  const sourceInfo = post.source_name ? `${post.source_name}${post.source_id ? ' · ' + post.source_id : ''}` : '';
  const createdAt = formatDate(post.created_at);
  const isHighConfidence = confidence >= 0.85;

  card.innerHTML = `
    <div class="post-card-header">
      ${renderTypeBadge(post.type)}
      ${renderSectorBadge(post.sector)}
      ${renderUrgencyBadge(post.urgency)}
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; margin-left:auto; padding-left:12px">
        ${renderConfidenceMeter(confidence)}
        ${isHighConfidence ? '<span style="font-size:11px; color:var(--accent-green); font-weight:600;">🤖 Alta confianza</span>' : ''}
      </div>
    </div>

    <div class="post-card-body">
      <div class="post-content-preview" id="preview-${post.id}">${previewText}</div>
      <button class="expand-btn" data-post-id="${post.id}" id="expand-btn-${post.id}">
        Ver completo ▾
      </button>

      <!-- Editor (hidden by default) -->
      <textarea class="post-editor" id="editor-${post.id}" maxlength="1300">${post.content || ''}</textarea>
      <div class="char-counter ok" id="counter-${post.id}">${(post.content || '').length} / 1300 caracteres</div>

      <div class="hashtags-preview" id="tags-${post.id}">
        ${renderHashtags(post.hashtags)}
      </div>
    </div>

    <div class="post-card-footer">
      <div class="post-meta">
        ${sourceInfo ? `📎 ${sourceInfo} · ` : ''}${createdAt}
        ${post.ai_score ? ` · Score IA: ${post.ai_score}/10` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="PostActions.showPreview('${post.id}')">
        👁 Preview
      </button>
      <button class="btn btn-ghost btn-sm" id="edit-btn-${post.id}" onclick="PostActions.toggleEdit('${post.id}')">
        ✏️ Editar
      </button>
      <button class="btn btn-danger btn-sm" onclick="PostActions.reject('${post.id}')">
        ❌ Rechazar
      </button>
      <button class="btn btn-success btn-sm" id="approve-btn-${post.id}" onclick="PostActions.approve('${post.id}')">
        ✅ Aprobar
      </button>
    </div>
  `;

  // Expand/collapse toggle
  const expandBtn = card.querySelector(`#expand-btn-${post.id}`);
  const previewEl = card.querySelector(`#preview-${post.id}`);
  expandBtn.addEventListener('click', () => {
    const isExp = previewEl.classList.toggle('expanded');
    expandBtn.textContent = isExp ? 'Ver menos ▴' : 'Ver completo ▾';
  });

  // Live char counter on editor
  const editor = card.querySelector(`#editor-${post.id}`);
  const counter = card.querySelector(`#counter-${post.id}`);
  editor.addEventListener('input', () => {
    const len = editor.value.length;
    counter.textContent = `${len} / 1300 caracteres`;
    counter.className = `char-counter ${len <= 1100 ? 'ok' : len <= 1300 ? 'warn' : 'over'}`;
  });

  return card;
}

// ── Post Actions ───────────────────────────────────────────
const PostActions = {
  async approve(postId) {
    const btn = document.getElementById(`approve-btn-${postId}`);
    const editor = document.getElementById(`editor-${postId}`);
    const isEditing = editor && editor.classList.contains('visible');
    const editedContent = isEditing ? editor.value : null;

    const originalContent = State.posts.find(p => p.id === postId)?.content || '';
    const editRatio = editedContent
      ? Math.round((levenshteinRatio(originalContent, editedContent)) * 100) / 100
      : 0;

    try {
      btn.disabled = true;
      btn.innerHTML = '<div class="loading-spinner"></div>';
      await API.approvePost(postId, editedContent);
      await API.recordFeedback({
        post_id: postId,
        decision: editedContent ? 'edited' : 'approved',
        edit_ratio: editRatio,
        time_to_decide_seconds: null,
        post_type: State.posts.find(p => p.id === postId)?.type,
        sector: State.posts.find(p => p.id === postId)?.sector,
        source_name: State.posts.find(p => p.id === postId)?.source_name,
        ai_score: State.posts.find(p => p.id === postId)?.ai_score,
        char_count: (editedContent || originalContent).length,
      });
      Toast.show('Post aprobado ✅', 'success');
      removePostCard(postId);
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
      btn.disabled = false;
      btn.innerHTML = '✅ Aprobar';
    }
  },

  async reject(postId) {
    try {
      await API.rejectPost(postId);
      await API.recordFeedback({
        post_id: postId,
        decision: 'rejected',
        edit_ratio: 0,
        post_type: State.posts.find(p => p.id === postId)?.type,
        sector: State.posts.find(p => p.id === postId)?.sector,
        source_name: State.posts.find(p => p.id === postId)?.source_name,
        ai_score: State.posts.find(p => p.id === postId)?.ai_score,
        char_count: (State.posts.find(p => p.id === postId)?.content || '').length,
      });
      Toast.show('Post rechazado', 'info');
      removePostCard(postId);
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
    }
  },

  toggleEdit(postId) {
    const editor = document.getElementById(`editor-${postId}`);
    const preview = document.getElementById(`preview-${postId}`);
    const expandBtn = document.getElementById(`expand-btn-${postId}`);
    const editBtn = document.getElementById(`edit-btn-${postId}`);
    const isEditing = editor.classList.toggle('visible');

    if (isEditing) {
      preview.style.display = 'none';
      expandBtn.style.display = 'none';
      editBtn.innerHTML = '✅ Aplicar edición';
      editor.focus();
    } else {
      const newContent = editor.value;
      preview.textContent = newContent;
      preview.style.display = '';
      expandBtn.style.display = '';
      editBtn.innerHTML = '✏️ Editar';
    }
  },

  showPreview(postId) {
    const post = State.posts.find(p => p.id === postId);
    if (!post) return;
    State.currentPreviewPostId = postId;
    const editor = document.getElementById(`editor-${postId}`);
    const content = (editor?.classList.contains('visible') ? editor.value : post.content) || '';

    document.getElementById('preview-body').textContent = content;
    document.getElementById('preview-modal').classList.add('visible');

    document.getElementById('approve-from-preview').onclick = () => {
      document.getElementById('preview-modal').classList.remove('visible');
      PostActions.approve(postId);
    };
  },
};

// Make PostActions global for inline onclick handlers
window.PostActions = PostActions;

// Remove post card with animation
function removePostCard(postId) {
  const card = document.getElementById(`post-card-${postId}`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
    card.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      card.remove();
      State.posts = State.posts.filter(p => p.id !== postId);
      updateStats();
      checkEmpty();
    }, 300);
  }
}

function checkEmpty() {
  const grid = document.getElementById('posts-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid || !emptyState) return;
  const cards = grid.querySelectorAll('.post-card');
  emptyState.style.display = cards.length === 0 ? 'block' : 'none';
}

// ── Levenshtein distance ratio ─────────────────────────────
function levenshteinRatio(a, b) {
  if (!a || !b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n] / Math.max(m, n);
}

// ── Filtering ──────────────────────────────────────────────
function applyFilters() {
  const query = (State.searchQuery || '').toLowerCase();
  State.filteredPosts = State.posts.filter(post => {
    const matchType = State.currentFilter === 'all' || post.type === State.currentFilter;
    const matchUrgency = State.currentUrgency === 'all' || post.urgency === State.currentUrgency;
    const matchSearch = !query || (post.content || '').toLowerCase().includes(query)
      || (post.source_name || '').toLowerCase().includes(query);
    return matchType && matchUrgency && matchSearch;
  });
  renderQueue();
}

function renderQueue() {
  const grid = document.getElementById('posts-grid');
  const subtitle = document.getElementById('queue-subtitle');
  if (!grid) return;
  grid.innerHTML = '';
  if (State.filteredPosts.length === 0) {
    checkEmpty();
    if (subtitle) subtitle.textContent = 'No hay posts que coincidan con los filtros.';
    return;
  }
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = 'none';
  if (subtitle) subtitle.textContent = `${State.filteredPosts.length} post${State.filteredPosts.length > 1 ? 's' : ''} pendiente${State.filteredPosts.length > 1 ? 's' : ''} de revisión`;
  State.filteredPosts.forEach((post, i) => {
    const card = renderPostCard(post);
    card.style.animationDelay = `${i * 50}ms`;
    grid.appendChild(card);
  });
}

// ── Stats Update ───────────────────────────────────────────
function updateStats() {
  const pending = State.posts.filter(p => p.status === 'pending').length;
  const el = document.getElementById('stat-pending');
  if (el) el.textContent = pending;
  const countEl = document.getElementById('pending-count');
  if (countEl) { countEl.textContent = pending; countEl.style.display = pending > 0 ? '' : 'none'; }
}

// ── Pages ──────────────────────────────────────────────────
const Pages = {

  async queue() {
    try {
      const [postsRes, statsRes] = await Promise.all([
        API.getPosts({ status: 'pending' }),
        API.getStats().catch(() => null),
      ]);

      State.posts = postsRes.posts || [];
      State.stats = statsRes;

      // Update stat cards
      const s = statsRes || {};
      if (document.getElementById('stat-pending')) document.getElementById('stat-pending').textContent = s.posts?.pending ?? State.posts.length;
      if (document.getElementById('stat-approved')) document.getElementById('stat-approved').textContent = s.posts?.approved ?? '—';
      if (document.getElementById('stat-published')) document.getElementById('stat-published').textContent = s.this_week?.published ?? '—';
      if (document.getElementById('stat-confidence')) {
        const conf = Math.round((s.learning?.avg_confidence || 0) * 100);
        document.getElementById('stat-confidence').textContent = `${conf}%`;
      }

      updateStats();
      applyFilters();
      checkEmpty();

      // Filter button events
      document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          State.currentFilter = btn.dataset.filter;
          applyFilters();
        });
      });

      document.querySelectorAll('[data-urgency]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-urgency]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          State.currentUrgency = btn.dataset.urgency;
          applyFilters();
        });
      });

      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          State.searchQuery = e.target.value;
          applyFilters();
        });
      }

      // Refresh btn
      document.getElementById('refresh-btn')?.addEventListener('click', () => Pages.queue());

      // Trigger BOE / news workflows
      document.getElementById('trigger-boe-btn')?.addEventListener('click', async () => {
        await API.triggerWorkflow('boe_daily.yml');
        Toast.show('BOE scraping iniciado en GitHub Actions', 'info');
      });
      document.getElementById('trigger-news-btn')?.addEventListener('click', async () => {
        await API.triggerWorkflow('news_scraper.yml');
        Toast.show('Búsqueda de noticias iniciada en GitHub Actions', 'info');
      });

    } catch (err) {
      Toast.show(`Error al cargar posts: ${err.message}`, 'error');
      console.error(err);
      const grid = document.getElementById('posts-grid');
      if (grid) grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error de conexión</div><div class="empty-state-sub">No se pudo conectar con la API. Comprueba la configuración.</div><br><a href="setup.html" class="btn btn-primary">Configurar →</a></div>`;
    }
  },

  async analytics() {
    try {
      const data = await API.getStats();
      const learning = data.learning || {};
      const posts = data.posts || {};

      // Stats
      if (document.getElementById('total-decisions')) document.getElementById('total-decisions').textContent = learning.total_decisions ?? '—';
      if (document.getElementById('approval-rate')) document.getElementById('approval-rate').textContent = learning.approval_rate != null ? `${Math.round(learning.approval_rate * 100)}%` : '—';
      if (document.getElementById('edit-rate')) document.getElementById('edit-rate').textContent = learning.edit_rate != null ? `${Math.round(learning.edit_rate * 100)}%` : '—';
      if (document.getElementById('weeks-to-auto')) document.getElementById('weeks-to-auto').textContent = learning.estimated_weeks_to_autopublish ?? '—';

      // Confidence gauge
      const conf = Math.round((learning.avg_confidence || 0) * 100);
      if (document.getElementById('confidence-pct')) document.getElementById('confidence-pct').textContent = `${conf}%`;
      if (document.getElementById('confidence-status')) {
        document.getElementById('confidence-status').textContent =
          conf < 40 ? 'Aprendiendo tus preferencias…' :
          conf < 70 ? 'Progresando bien' :
          conf < 90 ? '¡Casi listo para autopublicar!' :
          '🎉 Listo para autopublicación';
      }
      if (document.getElementById('main-confidence-bar')) {
        setTimeout(() => { document.getElementById('main-confidence-bar').style.width = `${conf}%`; }, 200);
      }

      // Phase
      const phase = learning.current_phase || 'control_total';
      if (phase === 'sugerencias' || phase === 'autopublicacion') {
        document.getElementById('phase-1')?.classList.add('completed');
        document.getElementById('phase-1')?.classList.remove('active');
        document.getElementById('phase-2')?.classList.add('active');
      }
      if (phase === 'autopublicacion') {
        document.getElementById('phase-2')?.classList.add('completed');
        document.getElementById('phase-2')?.classList.remove('active');
        document.getElementById('phase-3')?.classList.add('active');
      }

      // Sector bars
      const byS = learning.by_sector || {};
      const sectorBarsEl = document.getElementById('sector-bars');
      if (sectorBarsEl) {
        const sorted = Object.entries(byS).sort((a, b) => b[1].rate - a[1].rate);
        if (sorted.length === 0) {
          sectorBarsEl.innerHTML = '<div style="font-size:13px; color:var(--text-muted)">Aún no hay decisiones por sector.</div>';
        } else {
          sectorBarsEl.innerHTML = sorted.map(([sector, info]) => `
            <div class="sector-bar-row">
              <span class="sector-bar-label">${SECTOR_LABELS[sector] || sector}</span>
              <div class="sector-bar-track">
                <div class="sector-bar-fill" style="width:${Math.round(info.rate * 100)}%"></div>
              </div>
              <span class="sector-bar-pct">${Math.round(info.rate * 100)}%</span>
            </div>
          `).join('');
          setTimeout(() => {
            sectorBarsEl.querySelectorAll('.sector-bar-fill').forEach(el => {
              const w = el.style.width;
              el.style.width = '0%';
              setTimeout(() => { el.style.width = w; el.style.transition = 'width 0.8s ease'; }, 50);
            });
          }, 100);
        }
      }

      // Weekly chart (simple bar chart via CSS)
      const trend = learning.avg_confidence_trend || [];
      const chartEl = document.getElementById('weekly-chart');
      if (chartEl && trend.length > 0) {
        const maxVal = Math.max(...trend, 0.01);
        chartEl.innerHTML = trend.map((val, i) => {
          const pct = Math.round((val / maxVal) * 100);
          const color = val < 0.4 ? 'var(--accent-red)' : val < 0.7 ? 'var(--accent-amber)' : 'var(--accent-green)';
          return `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px">
              <span style="font-size:10px; color:var(--text-muted)">${Math.round(val*100)}%</span>
              <div style="width:100%; height:${pct}%; background:${color}; border-radius:4px 4px 0 0; transition:height 0.8s ease; min-height:4px"></div>
              <span style="font-size:10px; color:var(--text-muted)">S${i+1}</span>
            </div>`;
        }).join('');
      } else if (chartEl) {
        chartEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; width:100%">No hay datos todavía</div>';
      }

      // Preferences list
      const prefEl = document.getElementById('preferences-list');
      const prefItems = [];
      if (data.top_sectors?.length) {
        const top = data.top_sectors[0];
        prefItems.push(`✅ Sector más aprobado: <strong>${SECTOR_LABELS[top.sector] || top.sector}</strong> (${Math.round(top.rate * 100)}%)`);
      }
      if (learning.avg_approved_length) prefItems.push(`📏 Longitud preferida: <strong>~${learning.avg_approved_length} caracteres</strong>`);
      if (learning.preferred_type) prefItems.push(`📋 Tipo favorito: <strong>${learning.preferred_type === 'normativa' ? 'Normativa' : 'Actualidad'}</strong>`);
      if (prefEl) {
        prefEl.innerHTML = prefItems.length
          ? prefItems.map(p => `<div style="font-size:13px; color:var(--text-secondary)">${p}</div>`).join('')
          : '<div style="font-size:13px; color:var(--text-muted)">Acumula más decisiones para ver patrones.</div>';
      }

      // Pending count in sidebar
      if (document.getElementById('pending-count')) {
        const pending = posts.pending || 0;
        document.getElementById('pending-count').textContent = pending;
      }

    } catch (err) {
      Toast.show(`Error al cargar analytics: ${err.message}`, 'error');
    }
  },

  async history() {
    try {
      const [allPosts, statsRes] = await Promise.all([
        API.getPosts({ status: 'all', limit: 200 }),
        API.getStats().catch(() => null),
      ]);
      const posts = allPosts.posts || [];

      // Stats
      const published = posts.filter(p => p.status === 'published').length;
      const normativa = posts.filter(p => p.type === 'normativa' && p.status === 'published').length;
      const actualidad = posts.filter(p => p.type === 'actualidad' && p.status === 'published').length;
      const rejected = posts.filter(p => p.status === 'rejected').length;
      if (document.getElementById('hist-published')) document.getElementById('hist-published').textContent = published;
      if (document.getElementById('hist-normativa')) document.getElementById('hist-normativa').textContent = normativa;
      if (document.getElementById('hist-actualidad')) document.getElementById('hist-actualidad').textContent = actualidad;
      if (document.getElementById('hist-rejected')) document.getElementById('hist-rejected').textContent = rejected;

      // Pending count
      if (document.getElementById('pending-count')) {
        document.getElementById('pending-count').textContent = statsRes?.posts?.pending || '—';
      }

      // Table
      const tbody = document.getElementById('history-body');
      if (!tbody) return;
      if (posts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:40px">Sin historial todavía</td></tr>';
        return;
      }
      tbody.innerHTML = posts.map(post => {
        const preview = (post.content_edited || post.content || '').slice(0, 80) + '…';
        return `
          <tr>
            <td style="padding-left:20px; color:var(--text-muted)">${formatDate(post.published_at || post.created_at)}</td>
            <td>${renderTypeBadge(post.type)}</td>
            <td>${renderSectorBadge(post.sector)}</td>
            <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${(post.content||'').replace(/"/g,'')}">${preview}</td>
            <td style="color:var(--text-muted); font-size:12px">${post.source_name || '—'}</td>
            <td>${renderStatusPill(post.status)}</td>
            <td>
              ${post.status === 'published' && post.linkedin_post_id ? `<a href="https://www.linkedin.com/feed/update/${post.linkedin_post_id}" target="_blank" class="btn btn-ghost btn-sm">🔗 Ver</a>` : ''}
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      Toast.show(`Error al cargar historial: ${err.message}`, 'error');
    }
  },
};

// ── Preview Modal ──────────────────────────────────────────
function initModal() {
  const overlay = document.getElementById('preview-modal');
  if (!overlay) return;
  document.getElementById('close-preview')?.addEventListener('click', () => overlay.classList.remove('visible'));
  document.getElementById('close-preview-btn')?.addEventListener('click', () => overlay.classList.remove('visible'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });
}

function initHistoryModal() {
  const overlay = document.getElementById('post-modal');
  if (!overlay) return;
  document.getElementById('close-modal')?.addEventListener('click', () => overlay.classList.remove('visible'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });
}

// ── App Entry Point ────────────────────────────────────────
const App = {
  init(page) {
    // Check if configured
    if (!CONFIG.DASHBOARD_SECRET && page !== 'setup') {
      const banner = document.getElementById('setup-banner');
      if (banner) banner.style.display = 'flex';
    }
    initModal();
    initHistoryModal();
    if (Pages[page]) Pages[page]();
  },
};

window.App = App;
