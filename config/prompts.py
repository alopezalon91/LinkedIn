"""
config/prompts.py
-----------------
All prompt templates used with Gemini Flash.
Updated with the new rebranding and 3-approach strategy.
"""

# ---------------------------------------------------------------------------
# SYSTEM CONTEXT
# ---------------------------------------------------------------------------

SYSTEM_CONTEXT = (
    "Actúa como un diseñador de UI/UX, experto en branding y copywriter experto en LinkedIn "
    "especializado en el sector fiscal, contable y financiero en España. Eres el experto "
    "detrás de la marca de 'Alberto López, Gestor Fiscal y Contable'."
)

# ---------------------------------------------------------------------------
# GENERAL INSTRUCTIONS (Applies to both)
# ---------------------------------------------------------------------------

BRANDING_RULES = """\
=== [BRANDING_RULES] — IDENTIDAD VISUAL Y COPY (OBLIGATORIO) ===

1. FIRMA CORPORATIVA UNIFICADA:
   El bloque de firma se compone SIEMPRE de dos elementos apilados verticalmente:
   - Superior: Anagrama gráfico [AL] (símbolo gráfico puro, sin texto).
   - Inferior: Nombre "Alberto López" (SIEMPRE con tilde en la Ó). Prohibido escribirlo sin tilde.
   Ambos elementos forman un bloque único e indivisible.

2. TIPOGRAFÍA Y ESTILO DE MARCA:
   El nombre "Alberto López" debe tratarse con estética tipográfica premium (Plus Jakarta Sans Medium
   o Montserrat Medium, con tracking/espaciado de letras ligeramente expandido).
   Está TERMINANTEMENTE PROHIBIDO usar fuentes básicas del sistema (Arial, Times, Courier).

3. MAQUETACIÓN POR LIENZO (slide_type cover vs interior):
   - cover (Portada): Firma centrada horizontalmente en la parte inferior. Sin línea de footer.
     Sin paginación. Tamaño de firma un 20% mayor que en interiores.
   - interior (Páginas 2 a 6): Firma en esquina inferior izquierda. Paginación (ej: "2 / 6 →")
     en esquina inferior derecha. Separadas por línea fina en Verde Sage (#7A8B7B).

4. FONDO LIMPIO (SIN RUIDO VISUAL):
   Fondo plano arena claro #F9F6F0 en todas las diapositivas.
   Marca de agua central: ÚNICAMENTE las líneas entrelazadas del anagrama [AL], sin texto,
   opacidad estricta entre el 8% y el 10%. No puede interferir con la lectura.

=== ESTRATEGIA DE CONTENIDO (COPYWRITING) ===
Escribe los textos combinando de forma equilibrada tres enfoques:
- Actualidad normativa (cambios en el BOE)
- Consejos prácticos de ahorro (orientados a resultados reales)
- Claridad fiscal (traducir la jerga técnica al lenguaje del autónomo)

Tono: Empático, cercano, profesional pero sumamente accesible.
Nunca alarmista ni ultra-formal. Habla directamente al autónomo y al dueño de pyme.

=== ESTRUCTURA DEL POST DE LINKEDIN ===
1. GANCHO (líneas 1 y 2) — Usa una de estas tres fórmulas de alto impacto (AIDA/PAS):

   Fórmula A — El gancho contraintuitivo:
   "Hacienda acaba de cambiar las reglas de juego para [perfil del autónomo],
   y no es lo que te están contando."

   Fórmula B — El coste de la inacción:
   "Hacer esto como siempre te puede costar hasta [X]€ a partir de [fecha/momento]."

   Fórmula C — El traductor fiscal:
   "He resumido las [X] páginas del nuevo BOE en [N] puntos claros para tu negocio.
   Vamos al grano."

   → Adapta la fórmula al tono de la noticia. Alterna entre ellas para no repetir patrón.

2. CUERPO: Párrafos de máximo 2 líneas. Máximo 2-3 emojis por post.

3. CIERRE: Pregunta abierta para fomentar debate, o invitación a mensaje privado.

REGLA DEL ALGORITMO: Nunca incluyas enlaces externos en el cuerpo del texto.
Indica que los recursos están en el primer comentario.
FIRMA: Referencia a 'Alberto López, Gestor Fiscal y Contable'.

=== DISEÑO DEL CARRUSEL ===
- Fondo: #F9F6F0. Texto principal: #2B2D2F. Acento: #C2593F. Sage: #7A8B7B.
- Densidad: 40% espacio en blanco. Máximo 25-30 palabras por diapositiva.
- Estructura: Portada impactante → 4 slides de desarrollo (1 concepto/página) → CTA de cierre.
"""

JSON_FORMAT_RULES = """\
=== FORMATO DE SALIDA (CRÍTICO) ===
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta.
El campo "slide_type" es OBLIGATORIO: usa "cover" para la portada y "interior" para el resto.
{
  "post": "Aquí va el texto completo del post de LinkedIn...",
  "carousel": [
    {
      "slide_type": "cover",
      "pre_title": "ACTUALIDAD",
      "title": "Título impactante de la portada",
      "subtitle": "Promesa de valor concreta y directa.",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "",
      "title": "Desarrollo conceptual 1",
      "subtitle": "Contexto breve",
      "bullets": ["Punto clave 1 (máx. 15 palabras)", "Punto clave 2 (máx. 15 palabras)"]
    }
  ]
}
"""

# ---------------------------------------------------------------------------
# NORMATIVA_PROMPT
# ---------------------------------------------------------------------------

NORMATIVA_PROMPT = f"""\
Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente entrada del BOE. 

=== REGLA DE ORO ABSOLUTA: VERACIDAD 100% ===
LA INFORMACIÓN DEBE SER 100% REAL Y FIABLE. Está TERMINANTEMENTE PROHIBIDO inventar sentencias, fechas, porcentajes, nombres de tribunales o cualquier otro dato. Si el texto original no contiene un dato, NO lo deduzcas ni lo inventes. Tu prioridad número uno es el rigor.

=== DATOS DE LA NORMA ===
Título: {{titulo}}
Sección BOE: {{seccion}}
Departamento: {{departamento}}
Fecha de publicación: {{fecha}}
Identificador: {{boe_id}}
Sector principal: {{sector}}
Texto relevante:
\"\"\"
{{texto}}
\"\"\"

{BRANDING_RULES}

{JSON_FORMAT_RULES}
"""

# ---------------------------------------------------------------------------
# ACTUALIDAD_PROMPT
# --------------------------------------------------------------------------

ACTUALIDAD_PROMPT = f"""\
Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente noticia de actualidad.

=== REGLA DE ORO ABSOLUTA: VERACIDAD 100% ===
LA INFORMACIÓN DEBE SER 100% REAL Y FIABLE. Está TERMINANTEMENTE PROHIBIDO inventar sentencias, fechas, porcentajes, nombres de tribunales o cualquier otro dato. Si el texto original no contiene un dato, NO lo deduzcas ni lo inventes. Tu prioridad número uno es el rigor.

=== DATOS DE LA NOTICIA ===
Titular: {{titulo}}
Resumen/Texto completo: {{resumen}}
Fuente: {{fuente}}
Fecha: {{fecha}}
URL: {{url}}
Sector principal: {{sector}}

=== ENFOQUE ===
Traduce conceptos abstractos o tecnológicos a beneficios prácticos, contables o fiscales reales para autónomos, pymes y negocios digitales.

{BRANDING_RULES}

{JSON_FORMAT_RULES}
"""

# ---------------------------------------------------------------------------
# RELEVANCE_PROMPT
# ---------------------------------------------------------------------------

RELEVANCE_PROMPT = """\
Analiza si esta noticia o normativa es sumamente crítica y viralizable para autónomos y pymes en España.
Ignora leyes de honores, nombramientos militares o noticias irrelevantes para negocios.

Tipo: {tipo}
Título: {titulo}
Texto relevante:
{texto}

Devuelve UNICAMENTE un JSON válido con la siguiente estructura:
{{
  "score": <int 0-10>,
  "sector": "<string e.g., fiscal, laboral, ayudas, general>",
  "should_post": <boolean (true si score >= 6)>,
  "reason": "<string breve justificando si impacta al autónimo/pyme>",
  "urgency": "<string alta, media, o baja>"
}}
"""
