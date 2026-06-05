/**
 * Alberto López LinkedIn Automation — Dashboard App
 * Single JS module that powers all three dashboard pages.
 * Uses the Cloudflare Workers API (configured via WORKER_URL).
 */

'use strict';

// ── Configuration ─────────────────────────────────────────
const CONFIG = {
  // Cloudflare Worker API endpoint
  WORKER_URL: localStorage.getItem('worker_url') || 'https://mytaxbot-linkedin.a-lopezalon91.workers.dev',
  DASHBOARD_SECRET: localStorage.getItem('dashboard_secret') || 'd5a8fb21e7d97b0a790518d6bc1f9b3e',
  LINKEDIN_NAME: 'Alberto López',
  LINKEDIN_TITLE: 'Gestor contable y fiscal',
};

// Initialize localStorage defaults if not set, for seamless zero-setup on new machines/subdomains
if (!localStorage.getItem('worker_url')) {
  localStorage.setItem('worker_url', CONFIG.WORKER_URL);
}
if (!localStorage.getItem('dashboard_secret')) {
  localStorage.setItem('dashboard_secret', CONFIG.DASHBOARD_SECRET);
}
if (!localStorage.getItem('github_repo')) {
  localStorage.setItem('github_repo', 'alopezalon91/LinkedIn');
}

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
  currentView: 'pending',
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

  updatePost: (id, updates) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),

  approvePost: (id, editedContent, mediaBase64) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'approve', content_edited: editedContent || null, media_base64: mediaBase64 || null }),
  }),

  reviewPost: (id, editedContent) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'review', content_edited: editedContent || null }),
  }),
  regenerateCarousel: (id, editedContent) => API.request(`/api/posts/${id}/regenerate-carousel`, {
    method: 'POST',
    body: JSON.stringify({ content_edited: editedContent }),
  }),

  rejectPost: (id) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'reject' }),
  }),

  schedulePost: (id, scheduledAt, mediaBase64) => API.request(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'schedule', scheduled_at: scheduledAt, media_base64: mediaBase64 || null }),
  }),

  publishPost: (id) => API.request(`/api/publish/${id}`, { method: 'POST' }),

  recordFeedback: (data) => API.request('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getStats: () => API.request('/api/stats'),

  triggerWorkflow: async (workflow, inputs = null) => {
    const token = localStorage.getItem('github_token') || '';
    let repo  = localStorage.getItem('github_repo') || 'alopezalon91/LinkedIn';
    if (!token || !repo) {
      Toast.show('Configura el token de GitHub en Configuración', 'error');
      return false;
    }
    
    // Clean up repo string (support full URL, trailing/leading slashes, .git suffix)
    repo = repo.trim();
    if (repo.includes('github.com/')) {
      repo = repo.split('github.com/')[1];
    }
    repo = repo.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');

    try {
      const payload = { workflow, token, repo };
      if (inputs) {
        payload.inputs = inputs;
      }
      await API.request('/api/github/dispatch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return true;
    } catch (err) {
      Toast.show(`Error al iniciar workflow: ${err.message}`, 'error');
      return false;
    }
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
    reviewed: '👀 Revisado',
  };
  return `<span class="status-pill ${status}">${labels[status] || status}</span>`;
}

// ── Post Card Renderer ─────────────────────────────────────
function toBoldUnicode(text) {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120211);
    if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120205);
    if (code >= 48 && code <= 57) return String.fromCodePoint(code + 120764);
    return char;
  }).join('');
}

function formatLinkedInText(text) {
  // Parses Markdown bold **text** to Unicode bold
  return (text || '').replace(/\*\*(.*?)\*\*/g, (m, p1) => toBoldUnicode(p1));
}

function renderPostCard(post) {
  const card = document.createElement('div');
  card.className = `post-card urgency-${post.urgency}`;
  card.id = `post-card-${post.id}`;
  card.dataset.type = post.type;
  card.dataset.urgency = post.urgency;
  card.dataset.id = post.id;

  const baseText = post.content_edited || post.content || '';
  const previewText = formatLinkedInText(baseText).replace(/</g, '&lt;');
  const confidence = post.confidence_score || 0;
  let sourceInfo = '';
  if (post.source_name) {
    const nameStr = `${post.source_name}${post.source_id ? ' · ' + post.source_id : ''}`;
    sourceInfo = post.source_url ? `<a href="${post.source_url}" target="_blank" style="color:var(--accent-blue); text-decoration:none;" title="Ver fuente original">${nameStr}</a>` : nameStr;
  }
  const createdAt = formatDate(post.created_at);
  const isHighConfidence = confidence >= 0.85;

  let draftData = null;
  if (post.status === 'draft') {
    try {
      draftData = JSON.parse(post.content);
    } catch (e) {
      console.error("Error parsing draft data", e);
    }
  }

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
      ${post.status === 'draft' ? `
        <div style="padding:16px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:12px;">
          <h3 style="margin-top:0; color:var(--text-primary); font-size:16px;">${draftData ? draftData.title : 'Sin título'}</h3>
          <p style="color:var(--text-secondary); font-size:14px; line-height:1.5;">${draftData ? draftData.summary : 'Sin resumen'}</p>
        </div>
      ` : `
        <div class="post-content-preview" id="preview-${post.id}">${previewText}</div>
        <button class="expand-btn" data-post-id="${post.id}" id="expand-btn-${post.id}">
          Ver completo ▾
        </button>
  
        <!-- Editor (hidden by default) -->
        <textarea class="post-editor" id="editor-${post.id}" maxlength="2500">${post.content_edited || post.content || ''}</textarea>
        <div class="char-counter ok" id="counter-${post.id}">${(post.content_edited || post.content || '').length} / 2500 caracteres</div>
        ${post.content_edited ? `
          <div style="margin-top: 8px;">
            <button class="btn btn-ghost btn-sm" onclick="PostActions.undoRegenerate('${post.id}')" style="color: var(--accent-amber); font-size: 12px; padding: 4px 8px;">
              ↩️ Deshacer cambios
            </button>
          </div>
        ` : ''}

        <!-- Carousel Slide Editor (visible only when editing and has carousel) -->
        <div class="carousel-editor-section" id="carousel-editor-section-${post.id}" style="display:none; margin-top:12px; padding:12px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px;"></div>
  
        <!-- AI Rewrite Section (visible only when editing) -->
        <div class="ai-rewrite-section" id="ai-rewrite-section-${post.id}" style="display:none; margin-top:12px; padding:12px; background:rgba(255,255,255,0.02); border:1px dashed var(--border); border-radius:6px;">
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">🪄 Redactar de nuevo con Inteligencia Artificial:</label>
          <div style="display:flex; gap:8px; position:relative; align-items:center; width:100%;">
            <input type="text" id="ai-instructions-${post.id}" placeholder="Ej: Enfócalo para el sector inmobiliario..." style="flex:1; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:4px; padding:8px 36px 8px 8px; color:var(--text-primary); font-size:13px; outline:none;" />
            <button id="ai-mic-btn-${post.id}" onclick="PostActions.startVoiceRewrite('${post.id}')" style="position:absolute; right:115px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;" title="Dictar instrucciones">🎙️</button>
            <button class="btn btn-primary btn-sm" id="ai-rewrite-btn-${post.id}" onclick="PostActions.regenerateWithIA('${post.id}')" style="flex-shrink:0;">🪄 Rehacer post</button>
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px;">
            <button class="btn btn-ghost btn-sm" id="ai-carousel-btn-${post.id}" onclick="PostActions.regenerateCarouselWithIA('${post.id}')" style="border: 1px dashed var(--border-strong); background: transparent; display: flex; align-items: center; gap: 5px;">
              📸 Rehacer carrusel (según el texto editado)
            </button>
          </div>
          <div id="ai-rewrite-status-${post.id}" style="font-size:11px; color:var(--accent-red); margin-top:6px; display:none; align-items:center; gap:5px;">
            <span class="pulse-dot"></span> Grabando voz... Pulsa de nuevo el micrófono para parar.
          </div>
        </div>
      `}

      <div class="hashtags-preview" id="tags-${post.id}">
        ${renderHashtags(post.hashtags)}
      </div>
    </div>

    <div class="post-card-footer">
      <div class="post-meta">
        ${sourceInfo ? `📎 ${sourceInfo} · ` : ''}${createdAt}
        ${post.ai_score ? ` · Score IA: ${post.ai_score}/10` : ''}
        ${post.scheduled_at ? `<br>📅 Programado para: ${formatDate(post.scheduled_at)}` : ''}
      </div>
      
      ${post.status === 'draft' ? `
        <button class="btn btn-danger btn-sm" onclick="PostActions.reject('${post.id}')">
          ❌ Descartar Idea
        </button>
        <button class="btn btn-primary btn-sm" id="generate-btn-${post.id}" onclick="PostActions.generatePost('${post.id}')" style="font-weight:bold; background-color:var(--accent-purple);">
          ✨ Generar Post con IA
        </button>
      ` : `
        <button class="btn btn-ghost btn-sm" onclick="PostActions.showPreview('${post.id}')">
          👁 Preview
        </button>
        <button class="btn btn-ghost btn-sm" id="edit-btn-${post.id}" onclick="PostActions.toggleEdit('${post.id}')">
          ✏️ Editar
        </button>
        <button class="btn btn-danger btn-sm" onclick="PostActions.reject('${post.id}')">
          ❌ Rechazar
        </button>
        ${State.currentView === 'scheduled'
          ? `<button class="btn btn-outline btn-sm" onclick="PostActions.previewCarousel('${post.id}')" title="Ver imágenes generadas antes de publicar">📸 Previsualizar Carrusel</button>
             <button class="btn btn-primary btn-sm" onclick="PostActions.publishNow('${post.id}')">🚀 Publicar Ahora</button>
             <button class="btn btn-ghost btn-sm" onclick="PostActions.openScheduleModal('${post.id}')">🕒 Reprogramar</button>`
          : State.currentView === 'reviewed'
          ? `<button class="btn btn-outline btn-sm" onclick="PostActions.previewCarousel('${post.id}')" title="Ver imágenes generadas antes de publicar">📸 Previsualizar Carrusel</button>
             <button class="btn btn-primary btn-sm" onclick="PostActions.publishNow('${post.id}')">🚀 Publicar Ahora</button>
             <button class="btn btn-ghost btn-sm" onclick="PostActions.openScheduleModal('${post.id}')">🕒 Programar</button>`
          : `<button class="btn btn-success btn-sm" id="approve-btn-${post.id}" onclick="PostActions.approve('${post.id}')">✅ Aprobar</button>
             <button class="btn btn-outline btn-sm" onclick="PostActions.previewCarousel('${post.id}')" title="Ver imágenes generadas antes de publicar">📸 Previsualizar Carrusel</button>
             <button class="btn btn-primary btn-sm" onclick="PostActions.publishNow('${post.id}')">🚀 Publicar Ahora</button>
             <button class="btn btn-ghost btn-sm" onclick="PostActions.openScheduleModal('${post.id}')">🕒 Programar</button>`
        }
      `}
    </div>
  `;

  // Expand/collapse toggle (only for non-draft posts that have the expand button)
  const expandBtn = card.querySelector(`#expand-btn-${post.id}`);
  const previewEl = card.querySelector(`#preview-${post.id}`);
  if (expandBtn && previewEl) {
    expandBtn.addEventListener('click', () => {
      const isExp = previewEl.classList.toggle('expanded');
      expandBtn.textContent = isExp ? 'Ver menos ▴' : 'Ver completo ▾';
    });
  }

  // Live char counter on editor (only for non-draft posts)
  const editor = card.querySelector(`#editor-${post.id}`);
  const counter = card.querySelector(`#counter-${post.id}`);
  if (editor && counter) {
    editor.addEventListener('input', () => {
      const len = editor.value.length;
      counter.textContent = `${len} / 2500 caracteres`;
      counter.className = `char-counter ${len <= 2100 ? 'ok' : len <= 2500 ? 'warn' : 'over'}`;
    });
  }

  // Carousel button (uses state lookup to ensure fresh data)
  const carouselBtn = card.querySelector('.carousel-btn');
  if (carouselBtn) {
    carouselBtn.addEventListener('click', () => {
      PostActions.showCarousel(carouselBtn.dataset.postid);
    });
  }

  return card;
}

// ── Post Actions ───────────────────────────────────────────
const PostActions = {
  showCarousel(postId) {
    try {
      const post = State.posts.find(p => p.id === postId);
      if (!post || !post.media_base64) {
        Toast.show('No hay carrusel disponible para este post.', 'warning');
        return;
      }
      const base64 = post.media_base64;
      const decoded = decodeURIComponent(escape(atob(base64)));
      if (decoded.startsWith('CAROUSEL:')) {
        const slides = JSON.parse(decoded.slice(9));
        const slideArr = Array.isArray(slides) ? slides : (slides.slides || []);
        
        // Add fonts if not present
        if (!document.getElementById('carousel-fonts')) {
          const fontLink = document.createElement('link');
          fontLink.id = 'carousel-fonts';
          fontLink.rel = 'stylesheet';
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Lora:wght@500&display=swap';
          document.head.appendChild(fontLink);
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
        
        let currentSlide = 0;
        const render = () => {
          const s = slideArr[currentSlide];
          const iscover = s.slide_type === 'cover' || currentSlide === 0;
          
          const bulletsHtml = (s.bullets || []).map(b => 
            `<li style="position:relative;padding-left:20px;margin-bottom:16px;font-size:16px;font-weight:700;color:#2B2D2F;line-height:1.35;"><span style="position:absolute;left:0;color:#2B2D2F;">•</span>${b}</li>`
          ).join('');

          const signatureHtml = iscover 
            ? `<div style="position:absolute;bottom:5%;left:50%;transform:translateX(-50%);text-align:center;z-index:10;display:flex;flex-direction:column;align-items:center;">
                 <img src="/assets/img/monogram_solid.png" style="height:50px;object-fit:contain;margin-bottom:4px;opacity:0.9;">
                 <div style="font-family:'Lora',serif;font-weight:500;font-size:15px;color:#2B2D2F;letter-spacing:2px;">Alberto López</div>
               </div>`
            : `<div style="position:absolute;bottom:4%;left:10%;display:flex;flex-direction:column;align-items:center;z-index:10;">
                 <img src="/assets/img/monogram_solid.png" style="height:40px;object-fit:contain;margin-bottom:4px;opacity:0.9;">
                 <div style="font-family:'Lora',serif;font-weight:500;font-size:13px;color:#2B2D2F;letter-spacing:2px;">Alberto López</div>
               </div>`;

          const watermarkImg = iscover ? 'logo_watermark_cover.png' : 'logo_watermark_interior.png';

          const slideContent = iscover ? `
            <!-- COVER LAYOUT -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:15%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10%;text-align:center;z-index:2;overflow-y:auto;overflow-x:hidden;">
              ${s.pre_title ? `<div style="background:#C2593F;color:#FFF;border-radius:99px;padding:10px 24px;font-weight:800;font-size:15px;letter-spacing:1px;margin-bottom:24px;flex-shrink:0;">${s.pre_title}</div>` : ''}
              ${s.title ? `<h1 style="font-size:38px;font-weight:800;color:#2B2D2F;line-height:1.15;margin:0 0 20px 0;flex-shrink:0;">${s.title}</h1>` : ''}
              ${s.subtitle ? `<p style="font-size:20px;font-weight:500;color:#2B2D2F;line-height:1.4;margin:0;flex-shrink:0;">${s.subtitle}</p>` : ''}
            </div>
          ` : `
            <!-- INTERIOR LAYOUT -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:18%;padding:10% 10% 0 10%;display:flex;flex-direction:column;z-index:2;overflow-y:auto;overflow-x:hidden;">
              ${s.pre_title ? `<div style="align-self:flex-start;background:#C2593F;color:#FFF;border-radius:99px;padding:6px 16px;font-weight:800;font-size:13px;letter-spacing:1px;margin-bottom:24px;flex-shrink:0;">${s.pre_title}</div>` : ''}
              ${s.title ? `<h2 style="font-size:28px;font-weight:800;color:#2B2D2F;line-height:1.2;margin:0 0 16px 0;flex-shrink:0;">${s.title}</h2>` : ''}
              ${s.subtitle ? `<p style="font-size:18px;font-weight:500;color:#7A8B7B;line-height:1.3;margin:0 0 24px 0;flex-shrink:0;">${s.subtitle}</p>` : ''}
              ${bulletsHtml ? `<ul style="list-style:none;padding:0;margin:0;">${bulletsHtml}</ul>` : ''}
            </div>
            <!-- Separator Line -->
            <div style="position:absolute;bottom:17%;left:10%;right:10%;height:2px;background:#7A8B7B;z-index:2;"></div>
            <!-- Pagination -->
            <div style="position:absolute;bottom:6%;right:10%;font-size:15px;font-weight:700;color:#7A8B7B;z-index:2;">${currentSlide + 1} / ${slideArr.length} ${currentSlide === slideArr.length - 1 ? '' : '→'}</div>
          `;

          overlay.innerHTML = `
            <div style="position:relative;width:100%;max-width:600px;aspect-ratio:1/1;background:#F9F6F0;border-radius:12px;overflow:hidden;font-family:'Montserrat',sans-serif;box-shadow:0 25px 60px rgba(0,0,0,0.5);">
              <button onclick="this.closest('[style*=fixed]').remove()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.8);border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer;color:#2B2D2F;z-index:20;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.1);">✕</button>
              
              <!-- Watermark -->
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;pointer-events:none;">
                <img src="/assets/img/${watermarkImg}" style="width:60%;max-width:350px;object-fit:contain;">
              </div>
              
              ${slideContent}
              ${signatureHtml}
            </div>
            
            <div style="margin-top:24px;display:flex;gap:16px;width:100%;max-width:600px;justify-content:center;">
              <button id="prev-slide" style="padding:12px 24px;background:#333;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;font-family:'Montserrat',sans-serif;" ${currentSlide===0?'disabled style="opacity:0.3"':''}>← Anterior</button>
              <button id="next-slide" style="padding:12px 24px;background:#C2593F;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;font-family:'Montserrat',sans-serif;" ${currentSlide===slideArr.length-1?'disabled style="opacity:0.3"':''}>Siguiente →</button>
            </div>
          `;

          overlay.querySelector('#prev-slide')?.addEventListener('click', () => { if(currentSlide>0){currentSlide--;render();} });
          overlay.querySelector('#next-slide')?.addEventListener('click', () => { if(currentSlide<slideArr.length-1){currentSlide++;render();} });
        };
        
        render();
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
      } else {
        // Legacy: real PDF
        const pdfWindow = window.open("");
        if (pdfWindow) {
          pdfWindow.document.write(`<iframe width='100%' height='100%' style='border:none;margin:0;padding:0;' src='data:application/pdf;base64,${base64}'></iframe>`);
          pdfWindow.document.body.style.margin = "0";
          pdfWindow.document.title = "Carrusel PDF";
        } else {
          Toast.show('Por favor, permite los popups para ver el PDF.', 'warning');
        }
      }
    } catch(e) {
      Toast.show('Error al mostrar el carrusel: ' + e.message, 'error');
    }
  },

  openScheduleModal(postId) {
    const modal = document.getElementById('schedule-modal');
    modal.classList.add('visible');
    document.getElementById('confirm-schedule-btn').onclick = async () => {
      const date = document.getElementById('schedule-date').value;
      const time = document.getElementById('schedule-time').value;
      
      if (!date || !time) {
        Toast.show('Selecciona fecha y hora', 'warning');
        return;
      }
      
      const isoStr = new Date(`${date}T${time}`).toISOString();
      const editor = document.getElementById(`editor-${postId}`);
      const isEditing = editor && editor.classList.contains('visible');
      const editedContent = isEditing ? editor.value : null;

      try {
        const post = State.posts.find(p => p.id === postId);
        let newMedia = null;
        if (post && post.media_base64 && post.media_base64.length < 50000) {
          const decoded = decodeURIComponent(escape(atob(post.media_base64)));
          if (decoded.startsWith('CAROUSEL:')) {
            Toast.show('Renderizando imágenes...', 'info');
            newMedia = await PostActions.generateCarouselImages(post, post.media_base64);
          }
        }
        
        if (editedContent) {
          await API.approvePost(postId, editedContent, newMedia); // Save edits first
        }
        await API.schedulePost(postId, isoStr, newMedia);
        Toast.show('Post programado ✅', 'success');
        modal.classList.remove('visible');
        removePostCard(postId);
      } catch(e) {
        Toast.show('Error al programar: ' + e.message, 'error');
      }
    };
  },

  async generatePost(postId) {
    const btn = document.getElementById(`generate-btn-${postId}`);
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:5px;"></div> Redactando Post...';
      }
      await API.request(`/api/posts/${postId}/generate`, { method: 'POST' });
      Toast.show('¡Post generado con éxito! 🪄', 'success');
      // Reload queue to show the generated post
      Pages.queue();
    } catch (err) {
      Toast.show(`Error al generar post: ${err.message}`, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✨ Generar Post con IA';
      }
    }
  },

  async approve(postId) {
    const btn = document.getElementById(`approve-btn-${postId}`);
    const editor = document.getElementById(`editor-${postId}`);
    const isEditing = editor && editor.classList.contains('visible');
    const editedContent = isEditing ? editor.value : null;

    const originalContent = State.posts.find(p => p.id === postId)?.content || '';
    const hasEdits = editedContent && editedContent.trim() !== originalContent.trim();

    if (hasEdits) {
      PostActions.showEditFeedbackModal(postId, editedContent);
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner"></div>';
      }
      
      const post = State.posts.find(p => p.id === postId);
      let newMedia = null;
      if (post && post.media_base64 && post.media_base64.length < 50000) {
        // Might be JSON carousel
        const decoded = decodeURIComponent(escape(atob(post.media_base64)));
        if (decoded.startsWith('CAROUSEL:')) {
          Toast.show('Renderizando imágenes del carrusel...', 'info');
          newMedia = await PostActions.generateCarouselImages(post, post.media_base64);
        }
      }

      await API.approvePost(postId, null, newMedia);
      
      await API.recordFeedback({
        post_id: postId,
        decision: 'approved',
        edit_ratio: 0,
        time_to_decide_seconds: null,
        post_type: post?.type,
        sector: post?.sector,
        source_name: post?.source_name,
        ai_score: post?.ai_score,
        char_count: originalContent.length,
      });
      Toast.show('Post aprobado ✅', 'success');
      removePostCard(postId);
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✅ Aprobar';
      }
    }
  },

  async generateCarouselImages(post, mediaBase64) {
    return new Promise((resolve, reject) => {
      try {
        const decoded = decodeURIComponent(escape(atob(mediaBase64)));
        const data = JSON.parse(decoded.replace('CAROUSEL:', ''));
        const slideArr = Array.isArray(data) ? data : (data.slides || []);
        
        // Add fonts if not present
        if (!document.getElementById('carousel-fonts')) {
          const fontLink = document.createElement('link');
          fontLink.id = 'carousel-fonts';
          fontLink.rel = 'stylesheet';
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Lora:wght@500&display=swap';
          document.head.appendChild(fontLink);
        }

        // Create an offscreen container to render the slides
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '1080px';
        container.style.height = '1080px';
        container.style.background = '#F9F6F0';
        container.style.fontFamily = "'Montserrat', sans-serif";
        container.style.overflow = 'hidden';
        document.body.appendChild(container);

        const images = [];

        const renderSlide = async (index) => {
          if (index >= slideArr.length) {
            document.body.removeChild(container);
            const finalPayload = { type: 'multi-image', images };
            resolve(btoa(unescape(encodeURIComponent(JSON.stringify(finalPayload)))));
            return;
          }

          const s = slideArr[index];
          const iscover = s.slide_type === 'cover' || index === 0;
          container.innerHTML = '';
          
          const bulletsHtml = (s.bullets || []).map(b => 
            `<li style="position:relative;padding-left:36px;margin-bottom:28px;font-size:30px;font-weight:700;color:#2B2D2F;line-height:1.35;"><span style="position:absolute;left:0;color:#2B2D2F;">•</span>${b}</li>`
          ).join('');

          const signatureHtml = iscover 
            ? `<div style="position:absolute;bottom:5%;left:50%;transform:translateX(-50%);text-align:center;z-index:10;display:flex;flex-direction:column;align-items:center;">
                 <img src="/assets/img/monogram_solid.png" style="height:90px;object-fit:contain;margin-bottom:8px;opacity:0.9;">
                 <div style="font-family:'Lora',serif;font-weight:500;font-size:26px;color:#2B2D2F;letter-spacing:4px;">Alberto López</div>
               </div>`
            : `<div style="position:absolute;bottom:4%;left:10%;display:flex;flex-direction:column;align-items:center;z-index:10;">
                 <img src="/assets/img/monogram_solid.png" style="height:72px;object-fit:contain;margin-bottom:8px;opacity:0.9;">
                 <div style="font-family:'Lora',serif;font-weight:500;font-size:24px;color:#2B2D2F;letter-spacing:4px;">Alberto López</div>
               </div>`;

          const watermarkImg = iscover ? 'logo_watermark_cover.png' : 'logo_watermark_interior.png';

          const slideContent = iscover ? `
            <!-- COVER LAYOUT -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:15%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10%;text-align:center;z-index:2;">
              ${s.pre_title ? `<div style="background:#C2593F;color:#FFF;border-radius:99px;padding:18px 43px;font-weight:800;font-size:27px;letter-spacing:2px;margin-bottom:43px;">${s.pre_title}</div>` : ''}
              ${s.title ? `<h1 style="font-size:68px;font-weight:800;color:#2B2D2F;line-height:1.15;margin:0 0 36px 0;">${s.title}</h1>` : ''}
              ${s.subtitle ? `<p style="font-size:36px;font-weight:500;color:#2B2D2F;line-height:1.4;margin:0;">${s.subtitle}</p>` : ''}
            </div>
          ` : `
            <!-- INTERIOR LAYOUT -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:18%;padding:10% 10% 0 10%;display:flex;flex-direction:column;z-index:2;">
              ${s.pre_title ? `<div style="align-self:flex-start;background:#C2593F;color:#FFF;border-radius:99px;padding:10px 28px;font-weight:800;font-size:24px;letter-spacing:2px;margin-bottom:43px;">${s.pre_title}</div>` : ''}
              ${s.title ? `<h2 style="font-size:50px;font-weight:800;color:#2B2D2F;line-height:1.2;margin:0 0 28px 0;">${s.title}</h2>` : ''}
              ${s.subtitle ? `<p style="font-size:32px;font-weight:500;color:#7A8B7B;line-height:1.3;margin:0 0 43px 0;">${s.subtitle}</p>` : ''}
              ${bulletsHtml ? `<ul style="list-style:none;padding:0;margin:0;">${bulletsHtml}</ul>` : ''}
            </div>
            <!-- Separator Line -->
            <div style="position:absolute;bottom:17%;left:10%;right:10%;height:4px;background:#7A8B7B;z-index:2;"></div>
            <!-- Pagination -->
            <div style="position:absolute;bottom:6%;right:10%;font-size:27px;font-weight:700;color:#7A8B7B;z-index:2;">${index + 1} / ${slideArr.length} ${index === slideArr.length - 1 ? '' : '→'}</div>
          `;

          container.innerHTML = `
            <div style="position:relative;width:1080px;height:1080px;background:#F9F6F0;overflow:hidden;font-family:'Montserrat',sans-serif;">
              <!-- Watermark -->
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;">
                <img src="/assets/img/${watermarkImg}" style="width:60%;object-fit:contain;">
              </div>
              ${slideContent}
              ${signatureHtml}
            </div>
          `;
          
          // Wait a tick for fonts and images to load
          await new Promise(r => setTimeout(r, 500));
          
          // Use html2canvas to capture the element
          const canvas = await html2canvas(container, {
            scale: 1,
            useCORS: true,
            logging: false,
            backgroundColor: '#F9F6F0'
          });
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          images.push(dataUrl);
          
          await renderSlide(index + 1);
        };

        renderSlide(0).catch(err => {
          document.body.removeChild(container);
          reject(err);
        });

      } catch (e) {
        reject(e);
      }
    });
  },

  async previewCarousel(postId) {
    const post = State.posts.find(p => p.id === postId);
    if (!post || !post.media_base64) {
      Toast.show('Este post no tiene carrusel.', 'warning');
      return;
    }
    
    Toast.show('Generando imágenes del carrusel...', 'info');
    let media = post.media_base64;
    
    try {
      const decoded = decodeURIComponent(escape(atob(media)));
      if (decoded.startsWith('CAROUSEL:')) {
        media = await PostActions.generateCarouselImages(post, media);
      }
      
      const newDecoded = decodeURIComponent(escape(atob(media)));
      if (newDecoded.startsWith('{"type":"multi-image"')) {
        const payload = JSON.parse(newDecoded);
        const w = window.open('');
        w.document.write('<h2>Vista Previa del Carrusel (Imágenes a publicar)</h2><div style="display:flex; flex-direction:column; gap:20px; align-items:center; background:#f3f2ef; padding:20px;">');
        payload.images.forEach((img, i) => {
          w.document.write('<div style="background:white; padding:10px; border-radius:8px; box-shadow:0 0 10px rgba(0,0,0,0.1);"><h3 style="margin-top:0">Diapositiva ' + (i+1) + '</h3><img src="' + img + '" style="max-width:100%; border:1px solid #ccc; border-radius:4px;" /></div>');
        });
        w.document.write('</div>');
      } else {
        Toast.show('Formato de imagen no reconocido.', 'error');
      }
    } catch(err) {
      Toast.show('Error generando vista previa: ' + err.message, 'error');
    }
  },

  async publishNow(postId) {
    const editor = document.getElementById(`editor-${postId}`);
    const isEditing = editor && editor.classList.contains('visible');
    const editedContent = isEditing ? editor.value : null;

    if (isEditing) {
      Toast.show('Por favor, aplica la edición antes de publicar.', 'warning');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres publicar esto AHORA MISMO en LinkedIn?')) return;

    try {
      const btn = document.querySelector(`#post-card-${postId} .btn-primary`);
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner"></div> Publicando...';
      }
      
      const post = State.posts.find(p => p.id === postId);
      let newMedia = null;
      if (post && post.media_base64 && post.media_base64.length < 50000) {
        const decoded = decodeURIComponent(escape(atob(post.media_base64)));
        if (decoded.startsWith('CAROUSEL:')) {
          Toast.show('Renderizando carrusel...', 'info');
          newMedia = await PostActions.generateCarouselImages(post, post.media_base64);
        }
      }

      await API.approvePost(postId, null, newMedia);
      await API.publishPost(postId);
      Toast.show('¡Publicado con éxito en LinkedIn! 🚀', 'success');
      removePostCard(postId);
      loadStats();
    } catch (err) {
      Toast.show(`Error al publicar: ${err.message}`, 'error');
      App.loadPosts(); // Reload to reset UI
    }
  },

  async review(postId) {
    const btn = document.getElementById(`review-btn-${postId}`);
    const editor = document.getElementById(`editor-${postId}`);
    const isEditing = editor && editor.classList.contains('visible');
    const editedContent = isEditing ? editor.value : null;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner"></div>';
      }
      await API.reviewPost(postId, editedContent);
      Toast.show('Post movido a Revisados 👀', 'info');
      removePostCard(postId);
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '👁️ Marcar Revisado';
      }
    }
  },

  showEditFeedbackModal(postId, editedContent) {
    const overlay = document.getElementById('edit-feedback-modal');
    if (!overlay) {
      PostActions.confirmApproveWithEdits(postId, editedContent, 'Editado sin comentarios');
      return;
    }

    const reasonInput = document.getElementById('edit-reason-input');
    if (reasonInput) reasonInput.value = '';

    overlay.classList.add('visible');

    // Bind quick tags inside edit modal
    overlay.querySelectorAll('.rej-tag').forEach(btn => {
      btn.onclick = () => {
        if (reasonInput) {
          reasonInput.value = btn.getAttribute('data-text');
        }
      };
    });

    document.getElementById('confirm-edit-feedback-btn').onclick = async () => {
      const reason = reasonInput ? reasonInput.value.trim() : '';
      overlay.classList.remove('visible');
      stopEditMicRecording();
      await PostActions.confirmApproveWithEdits(postId, editedContent, reason || 'Editado sin comentarios');
    };

    document.getElementById('cancel-edit-feedback-btn').onclick = () => {
      overlay.classList.remove('visible');
      stopEditMicRecording();
    };

    document.getElementById('close-edit-feedback').onclick = () => {
      overlay.classList.remove('visible');
      stopEditMicRecording();
    };
  },

  async confirmApproveWithEdits(postId, editedContent, reason) {
    const btn = document.getElementById(`approve-btn-${postId}`);
    const originalContent = State.posts.find(p => p.id === postId)?.content || '';
    const editRatio = Math.round((levenshteinRatio(originalContent, editedContent)) * 100) / 100;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner"></div>';
      }
      
      const post = State.posts.find(p => p.id === postId);
      let newMedia = null;
      if (post && post.media_base64 && post.media_base64.length < 50000) {
        const decoded = decodeURIComponent(escape(atob(post.media_base64)));
        if (decoded.startsWith('CAROUSEL:')) {
          Toast.show('Renderizando imágenes...', 'info');
          newMedia = await PostActions.generateCarouselImages(post, post.media_base64);
        }
      }
      
      await API.approvePost(postId, editedContent, newMedia);
      await API.recordFeedback({
        post_id: postId,
        decision: 'edited',
        edit_ratio: editRatio,
        edit_reason: reason,
        time_to_decide_seconds: null,
        post_type: State.posts.find(p => p.id === postId)?.type,
        sector: State.posts.find(p => p.id === postId)?.sector,
        source_name: State.posts.find(p => p.id === postId)?.source_name,
        ai_score: State.posts.find(p => p.id === postId)?.ai_score,
        char_count: editedContent.length,
      });
      Toast.show('Post aprobado con cambios ✅', 'success');
      removePostCard(postId);
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✅ Aprobar';
      }
    }
  },

  reject(postId) {
    const overlay = document.getElementById('reject-modal');
    if (!overlay) {
      PostActions.confirmReject(postId, 'Rechazado sin comentarios');
      return;
    }

    // Reset fields
    const reasonInput = document.getElementById('reject-reason-input');
    if (reasonInput) reasonInput.value = '';

    overlay.classList.add('visible');

    // Bind quick tags
    document.querySelectorAll('.rej-tag').forEach(btn => {
      btn.onclick = () => {
        if (reasonInput) {
          reasonInput.value = btn.getAttribute('data-text');
        }
      };
    });

    document.getElementById('confirm-reject-btn').onclick = async () => {
      const reason = reasonInput ? reasonInput.value.trim() : '';
      overlay.classList.remove('visible');
      stopMicRecording();
      await PostActions.confirmReject(postId, reason || 'Rechazado sin comentarios');
    };

    document.getElementById('cancel-reject-btn').onclick = () => {
      overlay.classList.remove('visible');
      stopMicRecording();
    };

    document.getElementById('close-reject').onclick = () => {
      overlay.classList.remove('visible');
      stopMicRecording();
    };
  },

  async confirmReject(postId, reason) {
    try {
      await API.rejectPost(postId);
      await API.recordFeedback({
        post_id: postId,
        decision: 'rejected',
        edit_ratio: 0,
        rejection_reason: reason,
        post_type: State.posts.find(p => p.id === postId)?.type,
        sector: State.posts.find(p => p.id === postId)?.sector,
        source_name: State.posts.find(p => p.id === postId)?.source_name,
        ai_score: State.posts.find(p => p.id === postId)?.ai_score,
        char_count: (State.posts.find(p => p.id === postId)?.content || '').length,
      });
      Toast.show('Post rechazado ❌', 'info');
      removePostCard(postId);
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
    }
  },

  async toggleEdit(postId) {
    const editor = document.getElementById(`editor-${postId}`);
    const preview = document.getElementById(`preview-${postId}`);
    const expandBtn = document.getElementById(`expand-btn-${postId}`);
    const editBtn = document.getElementById(`edit-btn-${postId}`);
    const rewriteSec = document.getElementById(`ai-rewrite-section-${postId}`);
    const carouselSec = document.getElementById(`carousel-editor-section-${postId}`);
    const isEditing = editor.classList.contains('visible');
    const post = State.posts.find(p => p.id === postId);

    if (!isEditing) {
      // Opening editor
      editor.classList.add('visible');
      preview.style.display = 'none';
      expandBtn.style.display = 'none';
      editBtn.innerHTML = '✅ Aplicar edición';
      if (rewriteSec) rewriteSec.style.display = 'block';
      
      // Render slide editor if post has carousel
      if (post && post.media_base64 && carouselSec) {
        PostActions.renderSlideEditor(postId, post);
      }
      
      editor.focus();
    } else {
      // Closing editor
      const newContent = editor.value;
      const originalContent = post?.content || '';
      const previousEditedContent = post?.content_edited || '';
      const hasPostChanged = newContent.trim() !== (previousEditedContent || originalContent).trim();

      // Read edited slides
      let newMediaBase64 = post?.media_base64 || null;
      let hasCarouselChanged = false;
      
      if (post && post.media_base64 && carouselSec && carouselSec.style.display !== 'none') {
        const editedSlides = PostActions.getEditedSlides(postId, post);
        if (editedSlides) {
          const carouselStr = 'CAROUSEL:' + JSON.stringify(editedSlides);
          newMediaBase64 = btoa(unescape(encodeURIComponent(carouselStr)));
          hasCarouselChanged = newMediaBase64 !== post.media_base64;
        }
      }

      if (hasPostChanged || hasCarouselChanged) {
        editBtn.disabled = true;
        editBtn.innerHTML = '<div class="loading-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:4px;"></div> Guardando cambios...';
        try {
          const updates = {};
          if (hasPostChanged) updates.content_edited = newContent;
          if (hasCarouselChanged) updates.media_base64 = newMediaBase64;

          const res = await API.updatePost(postId, updates);
          
          // Update local state
          const postIndex = State.posts.findIndex(p => p.id === postId);
          if (postIndex !== -1) {
            State.posts[postIndex].media_base64 = res.media_base64;
            State.posts[postIndex].content_edited = res.content_edited;
          }
          Toast.show('Cambios guardados con éxito ✅', 'success');
          
          renderQueue();
          return;
        } catch (e) {
          Toast.show('Error al guardar cambios: ' + e.message, 'error');
        }
        editBtn.disabled = false;
      }

      editor.classList.remove('visible');
      preview.textContent = newContent;
      preview.style.display = '';
      expandBtn.style.display = '';
      editBtn.innerHTML = '✏️ Editar';
      if (rewriteSec) rewriteSec.style.display = 'none';
      if (carouselSec) carouselSec.style.display = 'none';
    }
  },

  showPreview(postId) {
    const post = State.posts.find(p => p.id === postId);
    if (!post) return;
    State.currentPreviewPostId = postId;
    const editor = document.getElementById(`editor-${postId}`);
    const content = (editor?.classList.contains('visible') ? editor.value : (post.content_edited || post.content)) || '';

    document.getElementById('preview-body').textContent = formatLinkedInText(content);
    document.getElementById('preview-modal').classList.add('visible');

    document.getElementById('approve-from-preview').onclick = () => {
      document.getElementById('preview-modal').classList.remove('visible');
      PostActions.approve(postId);
    };
  },

  startVoiceRewrite(postId) {
    const micBtn = document.getElementById(`ai-mic-btn-${postId}`);
    const textInput = document.getElementById(`ai-instructions-${postId}`);
    const statusEl = document.getElementById(`ai-rewrite-status-${postId}`);
    if (!micBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = 'none';
      Toast.show('Dictado no soportado en este navegador', 'error');
      return;
    }

    if (window.rewriteVoiceRecognition && window.activeRewritePostId) {
      const isSame = window.activeRewritePostId === postId;
      window.rewriteVoiceRecognition.stop();
      if (isSame) return;
    }

    window.activeRewritePostId = postId;
    window.rewriteVoiceRecognition = new SpeechRecognition();
    window.rewriteVoiceRecognition.lang = 'es-ES';
    window.rewriteVoiceRecognition.continuous = false;
    window.rewriteVoiceRecognition.interimResults = false;

    window.rewriteVoiceRecognition.onstart = () => {
      micBtn.classList.add('recording');
      micBtn.textContent = '🛑';
      if (statusEl) {
        statusEl.style.display = 'flex';
      }
    };

    window.rewriteVoiceRecognition.onend = () => {
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎙️';
      if (statusEl) statusEl.style.display = 'none';
      window.rewriteVoiceRecognition = null;
      window.activeRewritePostId = null;
    };

    window.rewriteVoiceRecognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        Toast.show('Error al grabar voz: ' + event.error, 'error');
      }
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎙️';
      if (statusEl) statusEl.style.display = 'none';
      window.rewriteVoiceRecognition = null;
      window.activeRewritePostId = null;
    };

    window.rewriteVoiceRecognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (text && textInput) {
        const prevVal = textInput.value.trim();
        textInput.value = prevVal ? prevVal + ' ' + text : text;
      }
    };

    window.rewriteVoiceRecognition.start();
  },

  async regenerateWithIA(postId) {
    const input = document.getElementById(`ai-instructions-${postId}`);
    const instructions = input ? input.value.trim() : '';
    if (!instructions) {
      Toast.show('Por favor, indica primero qué quieres cambiar del post', 'warning');
      return;
    }

    const rewriteBtn = document.getElementById(`ai-rewrite-btn-${postId}`);
    const statusEl = document.getElementById(`ai-rewrite-status-${postId}`);
    const editor = document.getElementById(`editor-${postId}`);

    try {
      if (rewriteBtn) {
        rewriteBtn.disabled = true;
        rewriteBtn.innerHTML = '<div class="loading-spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:5px;"></div> Procesando...';
      }
      if (statusEl) {
        statusEl.style.color = 'var(--accent-blue)';
        statusEl.innerHTML = '<span class="pulse-dot" style="background-color:var(--accent-blue);"></span> Reescribiendo post con Gemini...';
        statusEl.style.display = 'flex';
      }

      const response = await API.request(`/api/posts/${postId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ instructions })
      });

      // Update state and UI
      const postIdx = State.posts.findIndex(p => p.id === postId);
      if (postIdx !== -1) {
        State.posts[postIdx].content_edited = response.content_edited;
      }

      if (editor) {
        editor.value = response.content_edited || response.content;
        editor.dispatchEvent(new Event('input'));
      }

      if (input) input.value = '';
      Toast.show('Post reescrito con IA exitosamente 🪄', 'success');
      
      // Re-render to show the Undo button
      renderQueue();

    } catch (err) {
      Toast.show(`Error al rehacer post: ${err.message}`, 'error');
    } finally {
      if (rewriteBtn) {
        rewriteBtn.disabled = false;
        rewriteBtn.innerHTML = '🪄 Rehacer post';
      }
      if (statusEl) {
        statusEl.style.display = 'none';
      }
    }
  },

  async regenerateCarouselWithIA(postId) {
    const editor = document.getElementById(`editor-${postId}`);
    const content = editor ? editor.value.trim() : '';
    if (!content) {
      Toast.show('El texto del post no puede estar vacío', 'warning');
      return;
    }

    const carouselBtn = document.getElementById(`ai-carousel-btn-${postId}`);
    const statusEl = document.getElementById(`ai-rewrite-status-${postId}`);

    try {
      if (carouselBtn) {
        carouselBtn.disabled = true;
        carouselBtn.innerHTML = '<div class="loading-spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:5px;"></div> Procesando...';
      }
      if (statusEl) {
        statusEl.style.color = 'var(--accent-blue)';
        statusEl.innerHTML = '<span class="pulse-dot" style="background-color:var(--accent-blue);"></span> Regenerando carrusel con IA...';
        statusEl.style.display = 'flex';
      }

      const response = await API.request(`/api/posts/${postId}/regenerate-carousel`, {
        method: 'POST',
        body: JSON.stringify({ content_edited: content })
      });

      // Update state and UI
      const postIdx = State.posts.findIndex(p => p.id === postId);
      if (postIdx !== -1) {
        State.posts[postIdx].media_base64 = response.media_base64;
        State.posts[postIdx].content_edited = response.content_edited;
      }

      Toast.show('Carrusel regenerado con IA exitosamente 📸', 'success');
      
      // Re-render
      renderQueue();

    } catch (err) {
      Toast.show(`Error al rehacer carrusel: ${err.message}`, 'error');
    } finally {
      if (carouselBtn) {
        carouselBtn.disabled = false;
        carouselBtn.innerHTML = '📸 Rehacer carrusel (según el texto editado)';
      }
      if (statusEl) {
        statusEl.style.display = 'none';
      }
    }
  },

  renderSlideEditor(postId, post) {
    const container = document.getElementById(`carousel-editor-section-${postId}`);
    if (!container || !post.media_base64) return;
    
    try {
      const decoded = decodeURIComponent(escape(atob(post.media_base64)));
      if (!decoded.startsWith('CAROUSEL:')) {
        container.style.display = 'none';
        return;
      }
      
      const data = JSON.parse(decoded.replace('CAROUSEL:', ''));
      const slideArr = Array.isArray(data) ? data : (data.carousel || data.slides || []);
      if (!slideArr || slideArr.length === 0) {
        container.style.display = 'none';
        return;
      }
      
      container.style.display = 'block';
      
      let html = `
        <h4 style="margin: 0 0 12px 0; color: var(--text-primary); font-size: 13px; display: flex; align-items: center; gap: 8px;">
          📸 Editar Diapositivas del Carrusel:
        </h4>
        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 300px; overflow-y: auto; padding-right: 6px;">
      `;
      
      slideArr.forEach((s, idx) => {
        const isCover = s.slide_type === 'cover' || idx === 0;
        const slideLabel = isCover ? '🖼️ Portada' : `📄 Diapositiva ${idx}`;
        html += `
          <div class="slide-edit-card" style="padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 6px;">
            <div style="font-size: 11px; font-weight: bold; color: var(--accent-blue); margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
              ${slideLabel}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div>
                <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">🏷️ Categoría (etiqueta roja):</label>
                <input type="text" class="slide-input-pretitle-${postId}" data-index="${idx}" value="${s.pre_title || ''}" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 6px; color: var(--text-primary); font-size: 12px; outline: none;" placeholder="Ej: ACTUALIDAD, EL PROBLEMA..." />
              </div>
              <div>
                <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">📝 Título:</label>
                <input type="text" class="slide-input-title-${postId}" data-index="${idx}" value="${s.title || ''}" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 6px; color: var(--text-primary); font-size: 12px; outline: none;" />
              </div>
              <div>
                <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">💬 Subtítulo:</label>
                <input type="text" class="slide-input-subtitle-${postId}" data-index="${idx}" value="${s.subtitle || ''}" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 6px; color: var(--text-primary); font-size: 12px; outline: none;" />
              </div>
              ${!isCover ? `
              <div>
                <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">• Puntos clave (uno por línea):</label>
                <textarea class="slide-input-bullets-${postId}" data-index="${idx}" rows="3" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 6px; color: var(--text-primary); font-size: 12px; resize: vertical; outline: none; font-family: inherit;">${(s.bullets || []).join('\n')}</textarea>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
      container.innerHTML = html;
    } catch (e) {
      console.error('Error rendering slide editor:', e);
      container.style.display = 'none';
    }
  },

  getEditedSlides(postId, post) {
    const container = document.getElementById(`carousel-editor-section-${postId}`);
    if (!container || container.style.display === 'none') return null;
    
    try {
      const decoded = decodeURIComponent(escape(atob(post.media_base64)));
      const data = JSON.parse(decoded.replace('CAROUSEL:', ''));
      const slideArr = Array.isArray(data) ? data : (data.carousel || data.slides || []);
      
      const newSlides = [];
      
      slideArr.forEach((s, idx) => {
        const isCover = s.slide_type === 'cover' || idx === 0;
        
        const preTitleInput = container.querySelector(`.slide-input-pretitle-${postId}[data-index="${idx}"]`);
        const titleInput = container.querySelector(`.slide-input-title-${postId}[data-index="${idx}"]`);
        const subtitleInput = container.querySelector(`.slide-input-subtitle-${postId}[data-index="${idx}"]`);
        const bulletsInput = !isCover ? container.querySelector(`.slide-input-bullets-${postId}[data-index="${idx}"]`) : null;
        
        const pre_title = preTitleInput ? preTitleInput.value.trim() : '';
        const title = titleInput ? titleInput.value.trim() : '';
        const subtitle = subtitleInput ? subtitleInput.value.trim() : '';
        const bullets = bulletsInput ? bulletsInput.value.split('\n').map(b => b.trim()).filter(Boolean) : [];
        
        newSlides.push({
          slide_type: isCover ? 'cover' : 'interior',
          pre_title,
          title,
          subtitle,
          bullets
        });
      });
      
      return newSlides;
    } catch (e) {
      console.error('Error reading edited slides:', e);
      return null;
    }
  },

  async undoRegenerate(postId) {
    const editor = document.getElementById(`editor-${postId}`);
    const postIdx = State.posts.findIndex(p => p.id === postId);
    if (postIdx === -1) return;
    const post = State.posts[postIdx];
    
    try {
      await API.request(`/api/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content_edited: null })
      });
      
      // Update state
      post.content_edited = null;
      
      if (editor) {
        editor.value = post.content;
        editor.dispatchEvent(new Event('input'));
      }
      
      Toast.show('Cambios deshechos. Volviendo a la versión original.', 'success');
      
      // Re-render the queue to remove the undo button
      renderQueue();
    } catch (err) {
      Toast.show(`Error al deshacer cambios: ${err.message}`, 'error');
    }
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
      const statusFilter = State.currentView;
      const [postsRes, statsRes] = await Promise.all([
        API.getPosts({ status: statusFilter }),
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
      document.querySelectorAll('.view-tab').forEach(btn => {
        // Clear old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
          document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
          newBtn.classList.add('active');
          State.currentView = newBtn.dataset.view;
          Pages.queue(); // reload view
        });
      });

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
        const success = await API.triggerWorkflow('boe_daily.yml');
        if (success) {
          Toast.show('BOE scraping iniciado en GitHub Actions', 'success');
        }
      });
      document.getElementById('trigger-news-btn')?.addEventListener('click', async () => {
        const success = await API.triggerWorkflow('news_scraper.yml');
        if (success) {
          Toast.show('Búsqueda de noticias iniciada en GitHub Actions', 'success');
        }
      });
      document.getElementById('trigger-search-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('search-query-input');
        const query = input ? input.value.trim() : '';
        if (!query) {
          Toast.show('Escribe una palabra clave para buscar', 'warning');
          return;
        }
        const success = await API.triggerWorkflow('news_scraper.yml', { query });
        if (success) {
          Toast.show(`Búsqueda de "${query}" iniciada en GitHub Actions`, 'success');
          if (input) input.value = '';
        }
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
      if (document.getElementById('weeks-to-auto')) document.getElementById('weeks-to-auto').textContent = 'Manual';

      // Confidence gauge
      const conf = Math.round((learning.avg_confidence || 0) * 100);
      if (document.getElementById('confidence-pct')) document.getElementById('confidence-pct').textContent = `${conf}%`;
      if (document.getElementById('confidence-status')) {
        document.getElementById('confidence-status').textContent =
          conf < 40 ? 'Aprendiendo preferencias…' :
          conf < 70 ? 'Buen progreso del modelo' :
          conf < 90 ? 'Modelo muy afinado' :
          '🎯 Modelo optimizado';
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
      const [postsRes, statsRes] = await Promise.all([
        API.getPosts({ status: 'history', limit: 200 }),
        API.getStats().catch(() => null),
      ]);
      
      State.historyPosts = postsRes.posts || [];
      State.historyStatusFilter = 'all';
      State.historyTypeFilter = 'all';
      State.historySectorFilter = 'all';
      State.historySourceFilter = 'all';
      State.historySearchQuery = '';
      State.historySortColumn = 'date';
      State.historySortDirection = 'desc';

      // Stats
      const published = State.historyPosts.filter(p => p.status === 'published').length;
      const normativa = State.historyPosts.filter(p => p.type === 'normativa' && p.status === 'published').length;
      const actualidad = State.historyPosts.filter(p => p.type === 'actualidad' && p.status === 'published').length;
      const rejected = State.historyPosts.filter(p => p.status === 'rejected').length;
      if (document.getElementById('hist-published')) document.getElementById('hist-published').textContent = published;
      if (document.getElementById('hist-normativa')) document.getElementById('hist-normativa').textContent = normativa;
      if (document.getElementById('hist-actualidad')) document.getElementById('hist-actualidad').textContent = actualidad;
      if (document.getElementById('hist-rejected')) document.getElementById('hist-rejected').textContent = rejected;

      // Pending count in sidebar
      if (document.getElementById('pending-count')) {
        document.getElementById('pending-count').textContent = statsRes?.posts?.pending || '—';
      }

      // Populate Sector dropdown
      const sectorSelect = document.getElementById('hist-sector-select');
      if (sectorSelect) {
        sectorSelect.innerHTML = '<option value="all">Sectores: Todos</option>';
        const sectors = [...new Set(State.historyPosts.map(p => p.sector).filter(Boolean))];
        sectors.forEach(sec => {
          const label = SECTOR_LABELS[sec] || sec;
          const opt = document.createElement('option');
          opt.value = sec;
          opt.textContent = label;
          sectorSelect.appendChild(opt);
        });
        
        sectorSelect.onchange = (e) => {
          State.historySectorFilter = e.target.value;
          applyHistoryFilters();
        };
      }

      // Populate Source dropdown
      const sourceSelect = document.getElementById('hist-source-select');
      if (sourceSelect) {
        sourceSelect.innerHTML = '<option value="all">Fuentes: Todas</option>';
        const sources = [...new Set(State.historyPosts.map(p => p.source_name).filter(Boolean))];
        sources.forEach(src => {
          const opt = document.createElement('option');
          opt.value = src;
          opt.textContent = src;
          sourceSelect.appendChild(opt);
        });
        
        sourceSelect.onchange = (e) => {
          State.historySourceFilter = e.target.value;
          applyHistoryFilters();
        };
      }

      // Bind filter events
      const filterBar = document.querySelector('.filter-bar');
      if (filterBar) {
        // Status filters
        filterBar.querySelectorAll('[data-status]').forEach(btn => {
          btn.onclick = () => {
            filterBar.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.historyStatusFilter = btn.dataset.status;
            applyHistoryFilters();
          };
        });

        // Type filters
        filterBar.querySelectorAll('[data-type]').forEach(btn => {
          btn.onclick = () => {
            filterBar.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.historyTypeFilter = btn.dataset.type;
            applyHistoryFilters();
          };
        });
      }

      // Search box binding
      const searchInput = document.getElementById('hist-search');
      if (searchInput) {
        searchInput.oninput = (e) => {
          State.historySearchQuery = e.target.value.toLowerCase().trim();
          applyHistoryFilters();
        };
      }

      // Bind sortable headers
      const sortableHeaders = {
        'date': document.getElementById('th-date'),
        'type': document.getElementById('th-type'),
        'sector': document.getElementById('th-sector'),
        'source': document.getElementById('th-source'),
        'status': document.getElementById('th-status'),
      };
      
      Object.entries(sortableHeaders).forEach(([col, el]) => {
        if (el) {
          el.addEventListener('click', () => {
            toggleHistorySort(col);
          });
        }
      });

      // Initial render
      applyHistoryFilters();

    } catch (err) {
      Toast.show(`Error al cargar historial: ${err.message}`, 'error');
    }
  },
};

// ── History page dynamic filtering ───────────────────────────
function toggleHistorySort(column) {
  if (State.historySortColumn === column) {
    State.historySortDirection = State.historySortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    State.historySortColumn = column;
    State.historySortDirection = 'asc';
  }
  
  // Update sort icons in table headers
  const columns = ['date', 'type', 'sector', 'source', 'status'];
  columns.forEach(col => {
    const iconEl = document.getElementById(`sort-icon-${col}`);
    if (iconEl) {
      if (col === State.historySortColumn) {
        iconEl.textContent = State.historySortDirection === 'asc' ? ' ▲' : ' ▼';
        iconEl.style.color = 'var(--accent-blue)';
      } else {
        iconEl.textContent = ' ⇅';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });
  
  applyHistoryFilters();
}

function applyHistoryFilters() {
  const tbody = document.getElementById('history-body');
  if (!tbody) return;

  const filtered = (State.historyPosts || []).filter(post => {
    // Status filter
    const matchStatus = State.historyStatusFilter === 'all' || post.status === State.historyStatusFilter;
    
    // Type filter
    const matchType = State.historyTypeFilter === 'all' || post.type === State.historyTypeFilter;

    // Sector filter
    const matchSector = State.historySectorFilter === 'all' || post.sector === State.historySectorFilter;
    
    // Source filter
    const matchSource = State.historySourceFilter === 'all' || post.source_name === State.historySourceFilter;

    // Search query
    const content = (post.content_edited || post.content || '').toLowerCase();
    const sector = (post.sector || '').toLowerCase();
    const source = (post.source_name || '').toLowerCase();
    const matchSearch = !State.historySearchQuery || 
                        content.includes(State.historySearchQuery) || 
                        sector.includes(State.historySearchQuery) || 
                        source.includes(State.historySearchQuery);

    return matchStatus && matchType && matchSector && matchSource && matchSearch;
  });

  // Sort the filtered posts
  filtered.sort((a, b) => {
    let valA, valB;
    
    switch (State.historySortColumn) {
      case 'date':
        valA = new Date(a.published_at || a.created_at).getTime();
        valB = new Date(b.published_at || b.created_at).getTime();
        break;
      case 'type':
        valA = a.type || '';
        valB = b.type || '';
        break;
      case 'sector':
        valA = a.sector || '';
        valB = b.sector || '';
        break;
      case 'source':
        valA = a.source_name || '';
        valB = b.source_name || '';
        break;
      case 'status':
        valA = a.status || '';
        valB = b.status || '';
        break;
      default:
        valA = new Date(a.published_at || a.created_at).getTime();
        valB = new Date(b.published_at || b.created_at).getTime();
    }
    
    if (valA < valB) return State.historySortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return State.historySortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:40px">Sin resultados para esta selección</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(post => {
    const preview = (post.content_edited || post.content || '').slice(0, 80) + '…';
    return `
      <tr style="cursor:pointer;" class="history-row" data-id="${post.id}">
        <td style="padding-left:20px; color:var(--text-muted)">${formatDate(post.published_at || post.created_at)}</td>
        <td>${renderTypeBadge(post.type)}</td>
        <td>${renderSectorBadge(post.sector)}</td>
        <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="Ver detalle">${preview}</td>
        <td style="color:var(--text-muted); font-size:12px">${post.source_name || '—'}</td>
        <td>${renderStatusPill(post.status)}</td>
        <td>
          ${post.status === 'published' && post.linkedin_post_id ? `<a href="https://www.linkedin.com/feed/update/${post.linkedin_post_id}" target="_blank" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">🔗 Ver</a>` : ''}
          ${post.status === 'rejected' && post.rejection_reason ? `<span class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); alert('Motivo de rechazo: ${post.rejection_reason.replace(/'/g, "\\'")}')">💬 Motivo</span>` : ''}
          ${post.status === 'edited' && post.edit_reason ? `<span class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); alert('Cambios explicados: ${post.edit_reason.replace(/'/g, "\\'")}')">📝 Motivo</span>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  // Bind click listener on rows to open detail modal
  tbody.querySelectorAll('.history-row').forEach(row => {
    row.onclick = () => {
      const postId = row.dataset.id;
      const post = State.historyPosts.find(p => p.id === postId);
      if (post) {
        showPostDetailModal(post);
      }
    };
  });
}

function showPostDetailModal(post) {
  const overlay = document.getElementById('post-modal');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!overlay || !bodyEl) return;

  if (titleEl) {
    titleEl.textContent = `Detalle del Post — Estado: ${post.status.toUpperCase()}`;
  }

  let feedbackSection = '';
  if (post.status === 'rejected' && post.rejection_reason) {
    feedbackSection = `
      <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:12px; margin-top:16px">
        <strong style="color:var(--accent-red); font-size:13px; display:block; margin-bottom:4px">❌ Motivo del rechazo:</strong>
        <span style="font-size:13px; color:var(--text-secondary)">${post.rejection_reason}</span>
      </div>
    `;
  } else if (post.status === 'edited' && post.edit_reason) {
    feedbackSection = `
      <div style="background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.2); border-radius:6px; padding:12px; margin-top:16px">
        <strong style="color:var(--accent-blue); font-size:13px; display:block; margin-bottom:4px">📝 Cambios explicados:</strong>
        <span style="font-size:13px; color:var(--text-secondary)">${post.edit_reason}</span>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div style="font-size:14px; color:var(--text-primary); line-height:1.6; white-space:pre-wrap; max-height:400px; overflow-y:auto; padding-right:10px">
      ${post.content_edited || post.content}
    </div>
    ${feedbackSection}
    <div style="margin-top:20px; padding-top:12px; border-top:1px solid var(--border); font-size:12px; color:var(--text-muted); display:grid; grid-template-columns: 1fr 1fr; gap:10px">
      <div><strong>Sector:</strong> ${post.sector}</div>
      <div><strong>Fuente:</strong> ${post.source_name || '—'}</div>
      <div><strong>Score de relevancia:</strong> ${post.ai_score}/10</div>
      <div><strong>Fecha de creación:</strong> ${formatDate(post.created_at)}</div>
    </div>
  `;

  overlay.classList.add('visible');
}

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

// ── Rejection Modal & Voice Recognition ─────────────────────
let voiceRecognition = null;

function initRejectModal() {
  const overlay = document.getElementById('reject-modal');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('visible'); stopMicRecording(); } });
  initVoiceRecognition();
}

function initVoiceRecognition() {
  const micBtn = document.getElementById('reject-mic-btn');
  const textInput = document.getElementById('reject-reason-input');
  const statusEl = document.getElementById('mic-status');
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none'; // Speech recognition not supported in this browser
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = 'es-ES';
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;

  voiceRecognition.onstart = () => {
    micBtn.classList.add('recording');
    micBtn.textContent = '🛑';
    if (statusEl) statusEl.style.display = 'flex';
  };

  voiceRecognition.onend = () => {
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️';
    if (statusEl) statusEl.style.display = 'none';
  };

  voiceRecognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error !== 'no-speech') {
      Toast.show('Error al grabar voz: ' + event.error, 'error');
    }
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️';
    if (statusEl) statusEl.style.display = 'none';
  };

  voiceRecognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    if (text && textInput) {
      const prevVal = textInput.value.trim();
      textInput.value = prevVal ? prevVal + ' ' + text : text;
    }
  };

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) {
      voiceRecognition.stop();
    } else {
      voiceRecognition.start();
    }
  });
}

function stopMicRecording() {
  const micBtn = document.getElementById('reject-mic-btn');
  if (micBtn && micBtn.classList.contains('recording') && voiceRecognition) {
    voiceRecognition.stop();
  }
}

// ── Edit Feedback Modal & Voice Recognition ─────────────────
let editVoiceRecognition = null;

function initEditFeedbackModal() {
  const overlay = document.getElementById('edit-feedback-modal');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('visible'); stopEditMicRecording(); } });
  initEditVoiceRecognition();
}

function initEditVoiceRecognition() {
  const micBtn = document.getElementById('edit-mic-btn');
  const textInput = document.getElementById('edit-reason-input');
  const statusEl = document.getElementById('edit-mic-status');
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  editVoiceRecognition = new SpeechRecognition();
  editVoiceRecognition.lang = 'es-ES';
  editVoiceRecognition.continuous = false;
  editVoiceRecognition.interimResults = false;

  editVoiceRecognition.onstart = () => {
    micBtn.classList.add('recording');
    micBtn.textContent = '🛑';
    if (statusEl) statusEl.style.display = 'flex';
  };

  editVoiceRecognition.onend = () => {
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️';
    if (statusEl) statusEl.style.display = 'none';
  };

  editVoiceRecognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error !== 'no-speech') {
      Toast.show('Error al grabar voz: ' + event.error, 'error');
    }
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️';
    if (statusEl) statusEl.style.display = 'none';
  };

  editVoiceRecognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    if (text && textInput) {
      const prevVal = textInput.value.trim();
      textInput.value = prevVal ? prevVal + ' ' + text : text;
    }
  };

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) {
      editVoiceRecognition.stop();
    } else {
      editVoiceRecognition.start();
    }
  });
}

function stopEditMicRecording() {
  const micBtn = document.getElementById('edit-mic-btn');
  if (micBtn && micBtn.classList.contains('recording') && editVoiceRecognition) {
    editVoiceRecognition.stop();
  }
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
    initRejectModal();
    initEditFeedbackModal();
    initHistoryModal();
    if (Pages[page]) Pages[page]();
  },
};

window.App = App;
