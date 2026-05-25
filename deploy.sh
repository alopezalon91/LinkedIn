#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Liberfy LinkedIn Automation — Script de despliegue completo
# Ejecuta este script DESPUÉS de haber hecho login con Cloudflare
# Uso: bash deploy.sh
# ══════════════════════════════════════════════════════════════

set -e  # Parar si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

WRANGLER="$HOME/.local/bin/wrangler"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Liberfy LinkedIn Automation — Deploy Setup       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Paso 1: Verificar Wrangler ────────────────────────────────
log_step "Verificando Wrangler..."
if ! "$WRANGLER" --version &>/dev/null; then
  log_err "Wrangler no encontrado. Instálalo con: npm install -g wrangler --prefix ~/.local"
fi
log_ok "Wrangler $("$WRANGLER" --version 2>&1 | grep -oP '[\d.]+')"

# ── Paso 2: Crear D1 Database ─────────────────────────────────
log_step "Creando base de datos Cloudflare D1..."
cd "$(dirname "$0")/workers"

DB_OUTPUT=$("$WRANGLER" d1 create liberfy_linkedin 2>&1) || true
echo "$DB_OUTPUT"

# Extraer el database_id del output
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' || echo "")

if [ -z "$DB_ID" ]; then
  # Puede que ya exista — intentar obtener el ID
  DB_ID=$("$WRANGLER" d1 list 2>&1 | grep "liberfy_linkedin" | awk '{print $NF}' || echo "")
fi

if [ -z "$DB_ID" ]; then
  log_warn "No se pudo obtener el database_id automáticamente."
  echo -e "${YELLOW}Por favor, introduce el database_id de tu D1 database:${NC}"
  read -r DB_ID
fi

log_ok "Database ID: $DB_ID"

# ── Paso 3: Actualizar wrangler.toml con el database_id ───────
log_step "Actualizando wrangler.toml..."
sed -i.bak "s/YOUR_DATABASE_ID_HERE/$DB_ID/" wrangler.toml
log_ok "wrangler.toml actualizado"

# ── Paso 4: Aplicar schema SQL ────────────────────────────────
log_step "Aplicando schema SQL a D1..."
"$WRANGLER" d1 execute liberfy_linkedin --file=schema.sql --remote
log_ok "Schema aplicado correctamente"

# ── Paso 5: Configurar secrets ────────────────────────────────
log_step "Configurando secrets del Worker..."
echo ""
echo -e "${BOLD}Necesito que introduzcas las siguientes claves:${NC}"
echo "(Las puedes obtener de las URLs indicadas)"
echo ""

echo -e "${YELLOW}1. DASHBOARD_SECRET — una contraseña aleatoria para proteger tu dashboard${NC}"
echo -e "   (Genera una aquí: https://www.random.org/strings/?num=1&len=32&digits=on&loweralpha=on&unique=on&format=plain)"
echo -n "   Introduce tu DASHBOARD_SECRET: "
read -rs DASHBOARD_SECRET
echo ""
echo "$DASHBOARD_SECRET" | "$WRANGLER" secret put DASHBOARD_SECRET
log_ok "DASHBOARD_SECRET configurado"

echo ""
echo -e "${YELLOW}2. GEMINI_API_KEY — tu API key de Google AI Studio${NC}"
echo -e "   Obtén una gratis en: https://aistudio.google.com/app/apikey"
echo -n "   Introduce tu GEMINI_API_KEY: "
read -rs GEMINI_API_KEY
echo ""
echo "$GEMINI_API_KEY" | "$WRANGLER" secret put GEMINI_API_KEY
log_ok "GEMINI_API_KEY configurado"

# ── Paso 6: Desplegar el Worker ───────────────────────────────
log_step "Desplegando Worker en Cloudflare..."
DEPLOY_OUTPUT=$("$WRANGLER" deploy 2>&1)
echo "$DEPLOY_OUTPUT"

WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+workers\.dev' | head -1)
if [ -z "$WORKER_URL" ]; then
  echo -e "${YELLOW}Introduce la URL del Worker desplegado (ej: https://liberfy-linkedin.xxx.workers.dev):${NC}"
  read -r WORKER_URL
fi
log_ok "Worker desplegado en: $WORKER_URL"

# ── Paso 7: Configurar secrets de LinkedIn (para después) ─────
log_step "Configurando secrets de LinkedIn..."
echo ""
echo -e "${YELLOW}Para esto necesitas crear una app en LinkedIn Developer Portal.${NC}"
echo -e "${YELLOW}Ve a: https://www.linkedin.com/developers/apps/new${NC}"
echo ""
echo -e "Instrucciones:"
echo -e "  1. Crea la app (asociarla a tu página de Liberfy en LinkedIn)"
echo -e "  2. En 'Products', activa: 'Share on LinkedIn' y 'Sign In with LinkedIn using OpenID Connect'"
echo -e "  3. En 'Auth', añade este Redirect URL:"
echo -e "     ${BLUE}${WORKER_URL}/api/auth/callback${NC}"
echo -e "  4. Vuelve aquí con el Client ID y Client Secret"
echo ""
echo -n "¿Quieres configurar LinkedIn ahora? (s/n): "
read -r DO_LINKEDIN

if [ "$DO_LINKEDIN" = "s" ] || [ "$DO_LINKEDIN" = "S" ] || [ "$DO_LINKEDIN" = "y" ] || [ "$DO_LINKEDIN" = "Y" ]; then
  echo -n "LINKEDIN_CLIENT_ID: "
  read -rs LINKEDIN_CLIENT_ID
  echo ""
  echo "$LINKEDIN_CLIENT_ID" | "$WRANGLER" secret put LINKEDIN_CLIENT_ID

  echo -n "LINKEDIN_CLIENT_SECRET: "
  read -rs LINKEDIN_CLIENT_SECRET
  echo ""
  echo "$LINKEDIN_CLIENT_SECRET" | "$WRANGLER" secret put LINKEDIN_CLIENT_SECRET

  REDIRECT_URI="${WORKER_URL}/api/auth/callback"
  echo "$REDIRECT_URI" | "$WRANGLER" secret put LINKEDIN_REDIRECT_URI

  log_ok "Secretos de LinkedIn configurados"

  # Redesplegar con los nuevos secrets
  "$WRANGLER" deploy --quiet
  log_ok "Worker redesplegalado con secretos de LinkedIn"
else
  log_warn "Puedes configurar LinkedIn más tarde ejecutando de nuevo este script."
fi

# ── Paso 8: Resumen ───────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅  DESPLIEGUE COMPLETADO               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BOLD}Próximos pasos:${NC}"
echo ""
echo -e "1. ${BOLD}Dashboard:${NC} Despliega la carpeta 'dashboard/' en Cloudflare Pages:"
echo -e "   Cloudflare Dashboard → Pages → Create project → Upload assets → selecciona 'dashboard/'"
echo ""
echo -e "2. ${BOLD}LinkedIn OAuth:${NC} Ve a tu dashboard → Configuración → Autorizar LinkedIn"
echo -e "   URL del Worker: ${BLUE}${WORKER_URL}${NC}"
echo ""
echo -e "3. ${BOLD}GitHub Secrets:${NC} En tu repo → Settings → Secrets añade:"
echo -e "   GEMINI_API_KEY = (la que introdujiste)"
echo -e "   WORKER_URL     = ${WORKER_URL}"
echo -e "   WORKER_SECRET  = (el DASHBOARD_SECRET que introdujiste)"
echo ""
echo -e "4. ${BOLD}Test:${NC} Ejecuta el scraper BOE en modo prueba:"
echo -e "   ${BLUE}DRY_RUN=true python3 main.py --module boe${NC}"
echo ""

# Guardar la Worker URL para uso posterior
echo "WORKER_URL=$WORKER_URL" >> ../.env.local
echo -e "${GREEN}Worker URL guardada en .env.local${NC}"
