"""
config/prompts.py
-----------------
All prompt templates used with Gemini Flash.
Covers: SYSTEM_CONTEXT, NORMATIVA_PROMPT, ACTUALIDAD_PROMPT, and RELEVANCE_PROMPT.
"""

# ---------------------------------------------------------------------------
# SYSTEM CONTEXT
# Injected as the system instruction in every Gemini API call so that the
# model always knows its role and target audience.
# ---------------------------------------------------------------------------

SYSTEM_CONTEXT = (
    "Eres el asistente de Alberto López, gestor contable y fiscal independiente "
    "(especializado en ayudar a autónomos, pymes y emprendedores en toda España, abarcando "
    "tanto negocios tradicionales de barrio como negocios digitales de última generación: "
    "e-commerce, creadores de contenido, rent to rent e inversión inmobiliaria). "
    "Tu objetivo es generar contenido de alto valor práctico, claro y cercano para LinkedIn "
    "dirigido a autónomos, pymes y emprendedores de cualquier sector en España."
)

# ---------------------------------------------------------------------------
# NORMATIVA_PROMPT
# Used to generate a LinkedIn post from a BOE / regulatory entry.
# ---------------------------------------------------------------------------

NORMATIVA_PROMPT = """\
Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente entrada del BOE. \
El contenido debe estar completamente en español y redactado en un tono profesional, útil y cercano.

=== DATOS DE LA NORMA ===
Título: {titulo}
Sección BOE: {seccion}
Departamento: {departamento}
Fecha de publicación: {fecha}
Identificador: {boe_id}
Sector principal: {sector}
Texto relevante:
\"\"\"
{texto}
\"\"\"

=== FORMATO DE SALIDA (CRÍTICO) ===
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:
{{
  "post": "Aquí va el texto completo del post de LinkedIn...",
  "carousel": [
    {{
      "pre_title": "TITULAR CORTO",
      "title": "Tema Principal del Documento",
      "subtitle": "Referencia o información complementaria REAL",
      "bullets": []
    }},
    {{
      "pre_title": "",
      "title": "Idea principal 1 basada en el texto",
      "subtitle": "Más contexto si es aplicable y real",
      "bullets": [
        "Punto clave 1 extraído del texto.",
        "Punto clave 2 extraído del texto."
      ]
    }}
  ]
}}

=== REGLAS PARA EL "post" (Texto de LinkedIn) ===
1. Primera línea: emoji 🔔 seguido de un título llamativo de MÁXIMO 8 palabras que capture la esencia.
2. Un bloque de 2-4 líneas explicando detalladamente QUÉ ha cambiado de forma sencilla y directa.
3. Seción "Cómo te afecta:" con 2-4 bullets usando → (flecha). Desarrolla cada bullet en profundidad con ejemplos reales.
4. UNA SECCIÓN OBLIGATORIA (Si aplica): Si el texto se basa en una sentencia o resolución, DEBES INCLUIR el número exacto, el tribunal y la fecha (Ej: "📜 Sentencia: TSJ Madrid 136/2026 de 9 de marzo"). ESTO ES VITAL para dar seguridad jurídica al lector.
5. Una línea con "📅 Entrada en vigor:" y la fecha efectiva (SÓLO SI APARECE EN EL TEXTO).
6. Una pregunta interactiva final para invitar al debate.
7. Restricciones: Máximo 2100 caracteres. Tono claro y práctico. Sin jerga fiscal. Prohibido promocionar servicios. No añadas referencias a MyTaxBot. Hoy es {hoy}. Adáptalo temporalmente. Sin hashtags al final.
8. REGLA CRÍTICA ANTI-ALUCINACIONES: ESTÁ TOTAL Y ABSOLUTAMENTE PROHIBIDO INVENTAR DATOS. Si el texto proporcionado no cita una sentencia, NO inventes nombres de tribunales. Si no da una fecha exacta, NO la inventes. Toda la información debe emanar EXCLUSIVAMENTE del "Texto relevante".

=== REGLAS PARA EL "carousel" (Diapositivas PDF) ===
1. Debe ser una lista (array) de 3 a 5 objetos JSON.
2. Cada objeto (diapositiva) debe tener:
   - "pre_title": 1 o 2 palabras para una etiqueta naranja (ej: "Newsletter", "Novedad BOE", "Jurisprudencia").
   - "title": El título principal (grande).
   - "subtitle": Información complementaria (referencia legal, fecha, o pequeño resumen).
   - "bullets": Lista de strings (máximo 3 bullets por slide) con los puntos clave muy directos.
3. El primer slide (portada) suele tener bullets vacíos, enfocándose en el title y subtitle.
4. Diseñado para formato lista, cero paja. Todo debe leerse en 3 segundos.
"""

# ---------------------------------------------------------------------------
# ACTUALIDAD_PROMPT
# Used to generate a LinkedIn post from a press / news article.
# --------------------------------------------------------------------------

ACTUALIDAD_PROMPT = """\
Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente noticia de actualidad. \
El contenido debe estar en español y reflejar la perspectiva de Alberto López, gestor independiente.

=== DATOS DE LA NOTICIA ===
Titular: {titulo}
Resumen/Texto completo: {resumen}
Fuente: {fuente}
Fecha: {fecha}
URL: {url}
Sector principal: {sector}

=== ENFOQUE DE ADAPTACIÓN (CRÍTICO) ===
Si la noticia es de carácter tecnológico o de innovación: reenfoca y conecta esa tecnología directamente con los sectores de interés de los clientes de Alberto (autónomos de a pie, comercios, tiendas online, creadores de contenido o inversión inmobiliaria). Traduce conceptos abstractos a beneficios prácticos, contables o fiscales reales.

=== FORMATO DE SALIDA (CRÍTICO) ===
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:
{{
  "post": "Aquí va el texto completo del post de LinkedIn...",
  "carousel": [
    {{
      "pre_title": "TITULAR CORTO",
      "title": "Tema Principal de la Noticia",
      "subtitle": "Referencia o información complementaria REAL",
      "bullets": []
    }},
    {{
      "pre_title": "",
      "title": "Idea principal 1 basada en la noticia",
      "subtitle": "Más contexto si es aplicable y real",
      "bullets": [
        "Punto clave 1 extraído de la noticia.",
        "Punto clave 2 extraído de la noticia."
      ]
    }}
  ]
}}

=== REGLAS PARA EL "post" (Texto de LinkedIn) ===
1. Primera línea: emoji 💡 seguido de un titular conversacional (reescribe el original).
2. Contexto (3-5 líneas): explica los detalles didácticamente.
3. UNA SECCIÓN OBLIGATORIA (Si aplica): Si la noticia trata de una sentencia judicial o resolución, DEBES INCLUIR EXACTAMENTE el número de sentencia, tribunal y fecha (Ej: "📜 STS 123/2026 de 10 de Abril"). El lector debe poder consultarla.
4. "Qué significa para ti:" con 2-4 bullets (→) prácticos.
5. Opinión/Reflexión de Alberto (3-5 líneas): experiencia diaria o recomendación constructiva.
6. Pregunta interactiva final.
7. Restricciones: Máximo 2100 caracteres. Hoy es {hoy}. Sin menciones a MyTaxBot. Tono profesional y cercano. Sin venta de servicios. Sin hashtags al final. No añadas la URL en el cuerpo.
8. REGLA CRÍTICA ANTI-ALUCINACIONES: ESTÁ TOTAL Y ABSOLUTAMENTE PROHIBIDO INVENTAR DATOS. Si el resumen no menciona una sentencia, NO inventes sentencias. Si no hay leyes o porcentajes específicos, NO los inventes. Toda la información fáctica debe extraerse estrictamente del texto provisto.

=== REGLAS PARA EL "carousel" (Diapositivas PDF) ===
1. Debe ser una lista (array) de 3 a 5 objetos JSON.
2. Cada objeto (diapositiva) debe tener:
   - "pre_title": 1 o 2 palabras para una etiqueta naranja (ej: "Newsletter", "Novedad BOE", "Jurisprudencia").
   - "title": El título principal (grande).
   - "subtitle": Información complementaria (referencia legal, fecha, o pequeño resumen).
   - "bullets": Lista de strings (máximo 3 bullets por slide) con los puntos clave muy directos.
3. El primer slide (portada) suele tener bullets vacíos, enfocándose en el title y subtitle.
4. Diseñado para formato lista, cero paja. Todo debe leerse en 3 segundos.
"""

# ---------------------------------------------------------------------------
# RELEVANCE_PROMPT
# Classifies a BOE entry or news article and returns JSON.
# ---------------------------------------------------------------------------

RELEVANCE_PROMPT = """\
Eres un clasificador de contenido experto para la gestoría online MyTaxBot, especializada en \
autónomos, pymes, comercio tradicional, emprendedores, e-commerce (Amazon, Shopify), creadores \
de contenido (YouTube, Twitch, TikTok, KDP) y negocios inmobiliarios (rent to rent, flipping house).

Analiza el siguiente elemento y devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto adicional):

Tipo: {tipo}
Título: {titulo}
Texto:
\"\"\"
{texto}
\"\"\"

=== CAMPOS DEL JSON ===
{{
  "score": <entero 1-10, relevancia para autónomos, pymes y emprendedores españoles de cualquier sector>,
  "sector": "<uno de: ecommerce | content_creator | inmobiliario | iva_irpf | autonomos | pymes | normativa_europea | fiscal_internacional | general>",
  "should_post": <true si score >= 6, false en caso contrario>,
  "reason": "<una frase en español que justifica la puntuación>",
  "urgency": "<alta | media | baja>"
}}

=== CRITERIOS DE PUNTUACIÓN ===
- 9-10: Afecta directa y urgentemente a la mayoría de autónomos, pymes o sectores de interés (p.ej. subida general de cuotas, plazos tributarios, ayudas Kit Digital, reforma fiscal relevante).
- 7-8: Muy relevante y útil, como consejos fiscales prácticos, cambios de facturación o normativas sectoriales. También se incluyen aquí contenidos de calidad sobre fiscalidad internacional provenientes de fuentes de alto rigor técnico (Garrigues Blog Tributario, Legal Today Fiscalidad Internacional, Fixcal, Nómadas Fiscales, OCDE, EUR-Lex).
- 5-6: Interesante pero de interés más general o indirecto (p.ej. macroeconomía, datos estadísticos).
- 1-4: Sin relevancia para autónomos o pymes españolas, O BIEN, noticias y artículos excesivamente técnicos, teóricos o procedimentales orientados a profesionales del sector (asesores, gestores, auditores, contables) que no aportan valor práctico y directo al público general o dueños de negocios.

Nota especial para sector fiscal_internacional: Usar este sector cuando el contenido trate sobre residencia fiscal, convenios de doble imposición, estructuras internacionales, Ley Beckham, Pillar 2 OCDE, exit tax, o análisis de jurisdicciones (Andorra, Emiratos, Malta, Chipre, etc.). Este sector se trabaja con máximo rigor.

=== URGENCIA ===
- alta: Entrada en vigor en los próximos 30 días, o plazo de solicitud de ayuda inminente.
- media: Plazo de 1 a 6 meses, o cambio relevante pero sin urgencia administrativa.
- baja: Consulta tributaria, previsiones futuras, opinión o debate sin fecha o plazo regulado.

Devuelve SOLO el JSON, sin texto extra.
"""
