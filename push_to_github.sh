#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# MyTaxBot — Script para subir el proyecto a GitHub
# ══════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Subir proyecto MyTaxBot a GitHub            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Solicitar el Token de GitHub
echo -n "🔑 Introduce tu Token de GitHub (ghp_...): "
read -rs GITHUB_TOKEN
echo ""

# Solicitar el usuario de GitHub
echo -n "👤 Introduce tu usuario de GitHub (ej: alopezalon91): "
read -r GITHUB_USER

# Solicitar el nombre del repositorio
echo -n "📁 Introduce el nombre del nuevo repositorio (ej: mytaxbot-linkedin): "
read -r REPO_NAME

echo ""
echo "1️⃣  Creando el repositorio privado en GitHub..."

CREATE_RESP=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"private\":true}")

if echo "$CREATE_RESP" | grep -q '"id":'; then
  echo "✅ ¡Repositorio creado con éxito en tu cuenta de GitHub!"
else
  # Intentar extraer el mensaje de error de la API de GitHub
  ERROR_MSG=$(echo "$CREATE_RESP" | grep -o '"message":"[^"]*' | cut -d'"' -f4 || echo "Error desconocido")
  echo "❌ Error al crear el repositorio en GitHub: $ERROR_MSG"
  echo "Si el repositorio ya existía, intentaremos configurar el remote y subirlo igualmente."
fi

echo ""
echo "2️⃣  Configurando Git local..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git"

echo ""
echo "3️⃣  Subiendo los archivos a la rama main..."
git branch -M main
git push -u origin main --force

echo ""
echo "🎉 ¡Completado con éxito!"
echo "Tu código ya está subido en: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
