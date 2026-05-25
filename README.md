# 📊 Liberfy LinkedIn Automation

Sistema de automatización de contenido para LinkedIn de **Alberto López** (Liberfy).  
Genera y publica posts sobre normativa fiscal y noticias relevantes para autónomos, pymes, e-commerce y negocios inmobiliarios.

**Coste: 0 €/mes** · **Stack: GitHub Actions + Cloudflare + Gemini Flash + LinkedIn API**

---

## 🏗️ Arquitectura

```
GitHub Actions (cron)
    ↓ genera posts con Gemini Flash
Cloudflare Workers API
    ↓ almacena en Cloudflare D1
Cloudflare Pages (dashboard)
    ↓ tú revisas y apruebas
LinkedIn API (publicación directa)
```

---

## ⚡ Setup — Solo una vez (~20 minutos)

### Paso 1: Google AI Studio (Gemini Flash)

1. Ve a [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Crea un nuevo proyecto → **Get API key**
3. Copia la key — la usarás en el paso 3

### Paso 2: Cloudflare — Base de datos D1

Necesitas tener [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) instalado:

```bash
npm install -g wrangler
wrangler login

cd workers/
wrangler d1 create liberfy_linkedin
# Copia el database_id que aparece y ponlo en wrangler.toml
npm run db:init
```

### Paso 3: Cloudflare — Desplegar el Worker

```bash
# Generar un secret aleatorio para el dashboard
python -c "import secrets; print(secrets.token_hex(32))"

# Configurar secrets en el Worker
wrangler secret put DASHBOARD_SECRET   # el secret que acabas de generar
wrangler secret put GEMINI_API_KEY     # tu key de Google AI Studio

# Desplegar
npm run deploy
# Anota la URL del Worker: https://liberfy-linkedin.TU_SUBDOMAIN.workers.dev
```

### Paso 4: LinkedIn — Crear app y vincular cuenta

1. Ve a [linkedin.com/developers/apps/new](https://www.linkedin.com/developers/apps/new)
2. Crea una app (necesitarás asociarla a una página de empresa — puedes crear una vacía)
3. En la pestaña **Products**: activa **Share on LinkedIn** y **Sign In with LinkedIn using OpenID Connect**
4. En la pestaña **Auth**: añade como Redirect URL → `https://liberfy-linkedin.TU_SUBDOMAIN.workers.dev/api/auth/callback`
5. Configura los secrets del Worker con tus credenciales de LinkedIn:

```bash
wrangler secret put LINKEDIN_CLIENT_ID      # de la pestaña Auth de tu LinkedIn App
wrangler secret put LINKEDIN_CLIENT_SECRET  # de la pestaña Auth de tu LinkedIn App
wrangler secret put LINKEDIN_REDIRECT_URI   # https://liberfy-linkedin.TU_SUBDOMAIN.workers.dev/api/auth/callback
```

6. Vuelve a desplegar: `npm run deploy`
7. Visita tu dashboard → **Configuración** → **Autorizar LinkedIn** para vincular tu cuenta

### Paso 5: GitHub — Variables de entorno (Secrets)

En tu repositorio de GitHub: **Settings → Secrets and variables → Actions**

| Secret | Valor |
|--------|-------|
| `GEMINI_API_KEY` | Tu key de Google AI Studio |
| `WORKER_URL` | `https://liberfy-linkedin.TU_SUBDOMAIN.workers.dev` |
| `WORKER_SECRET` | El secret que generaste en el paso 3 |

### Paso 6: GitHub — Mueve los workflows

```bash
# Los workflows están en github/workflows/ — muévelos a .github/workflows/
mkdir -p .github/workflows
mv github/workflows/*.yml .github/workflows/
rmdir github/workflows github
```

### Paso 7: Cloudflare Pages — Publicar el dashboard

```bash
# Opción A: Desde Cloudflare Dashboard
# → Pages → Create project → Connect to Git → selecciona tu repo
# → Build settings: Output directory = dashboard (sin build command)

# Opción B: Con Wrangler
wrangler pages publish dashboard --project-name liberfy-linkedin
```

### Paso 8: Instalar dependencias Python (para desarrollo local)

```bash
pip install -r requirements.txt
cp .env.example .env
# Edita .env con tus keys
```

---

## 🚀 Uso diario

### Dashboard
Accede desde tu URL de Cloudflare Pages para:
- **Revisar** los posts generados automáticamente
- **Editar** el texto si quieres ajustar algo
- **Aprobar** (el sistema lo publica en LinkedIn)
- **Rechazar** (el sistema aprende que no te gustó)
- **Ver el progreso** del sistema de aprendizaje

### Triggers automáticos
| Cuándo | Qué hace |
|--------|----------|
| Lunes–Viernes 9:30h | Scraper BOE: busca normativa del día |
| 10h, 16h, 22h | Scraper noticias: RSS de prensa económica |
| Domingos 6:00h | Renueva automáticamente el token de LinkedIn |

### Trigger manual
Desde el dashboard (sidebar) puedes lanzar manualmente el scraper del BOE o de noticias cuando quieras.

---

## 📁 Estructura del proyecto

```
liberfy-linkedin/
├── .github/workflows/          # Cron jobs de GitHub Actions
│   ├── boe_daily.yml           # BOE diario (Lun-Vie 7:30 UTC)
│   ├── news_scraper.yml        # Noticias cada 6h
│   └── token_refresh.yml       # Renovación LinkedIn token (domingos)
│
├── config/                     # Configuración del sistema
│   ├── prompts.py              # Prompts para Gemini Flash
│   ├── sectors.py              # Categorías y keywords de Liberfy
│   └── sources.py              # URLs de BOE, RSS, prensa
│
├── scrapers/                   # Módulos de extracción de datos
│   ├── boe_scraper.py          # API oficial del BOE
│   ├── ccaa_scraper.py         # Boletines autonómicos
│   └── news_scraper.py         # RSS prensa económica
│
├── ai/                         # Módulos de inteligencia artificial
│   ├── relevance_scorer.py     # Puntúa relevancia 1-10
│   ├── content_generator.py    # Genera posts con Gemini Flash
│   └── learning_model.py       # Sistema de aprendizaje progresivo
│
├── workers/                    # Backend Cloudflare Workers
│   ├── schema.sql              # Schema base de datos D1
│   ├── wrangler.toml           # Configuración Cloudflare
│   ├── package.json
│   └── src/
│       ├── index.js            # Router principal (14 endpoints)
│       ├── utils.js            # Utilidades compartidas
│       └── api/
│           ├── posts.js        # CRUD posts
│           ├── publish.js      # Publicación LinkedIn
│           ├── feedback.js     # Sistema de aprendizaje
│           ├── stats.js        # Estadísticas dashboard
│           └── linkedin_auth.js # OAuth LinkedIn
│
├── dashboard/                  # Frontend (Cloudflare Pages)
│   ├── index.html              # Cola de revisión
│   ├── analytics.html          # Sistema de aprendizaje
│   ├── history.html            # Historial de publicaciones
│   ├── setup.html              # Configuración
│   └── assets/
│       ├── style.css           # Diseño dark mode
│       └── app.js              # Lógica del dashboard
│
├── main.py                     # Orquestador principal (lo llama GitHub Actions)
├── requirements.txt            # Dependencias Python
└── .env.example                # Template de variables de entorno
```

---

## 🧠 Sistema de aprendizaje

El sistema aprende de cada decisión que tomas:

| Fase | Cuándo | Qué ocurre |
|------|--------|------------|
| **Fase 1: Control total** | Inicio → ~8 semanas | Todos los posts pasan por revisión |
| **Fase 2: Sugerencias** | Confianza > 60% | El sistema marca posts con alta confianza |
| **Fase 3: Autopublicación** | Confianza > 90% + 50 decisiones | Posts de alta confianza se publican solos |

Puedes ver el progreso en el dashboard → **Aprendizaje**.

---

## 💡 Fuentes monitorizadas

### Normativa
- BOE (API oficial — sumario diario)
- EUR-Lex (Diario Oficial de la UE)
- BOCM (Madrid), DOGC (Cataluña), BOJA (Andalucía)
- AEAT notas informativas, Seguridad Social

### Actualidad (prensa contrastada)
- Expansión, El Economista, Cinco Días
- Idealista News (inmobiliario)
- El Referente (startups/digital)
- AEAT y Seguridad Social (fuentes oficiales)

**Regla de credibilidad**: una noticia se genera solo si ≥2 fuentes la cubren, o si viene de una fuente oficial.

---

## 🔧 Desarrollo local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Probar scraper BOE (modo dry run — no envía nada)
DRY_RUN=true python main.py --module boe

# Probar scraper noticias
DRY_RUN=true python main.py --module news

# Desarrollar el Worker localmente
cd workers && npm run dev
```

---

## ❓ FAQ

**¿El token de LinkedIn expira?**  
Sí, cada 60 días. El workflow `token_refresh.yml` lo renueva automáticamente cada domingo. Si falla, recibirás un error en GitHub Actions.

**¿Qué pasa si Gemini Flash alcanza el límite gratuito?**  
El límite es de 250 requests/día. Generamos máx. 5-8 posts/día, muy por debajo. Si se supera, el scraper espera al día siguiente.

**¿Puedo cambiar el horario de publicación?**  
Sí, edita las expresiones cron en `.github/workflows/boe_daily.yml` y `news_scraper.yml`.

**¿Se puede publicar en una página de empresa de LinkedIn también?**  
Actualmente está configurado para perfil personal. Para páginas de empresa se necesita el producto "Marketing Developer Platform" de LinkedIn (requiere aprobación).

---

## 📄 Licencia

Proyecto privado de uso personal. © 2025 Alberto López / Liberfy.
