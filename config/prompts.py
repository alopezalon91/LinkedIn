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
    "Eres el asistente de Alberto López, gestor contable y fiscal en MyTaxBot "
    "(gestoría online para autónomos, pymes y emprendedores en toda España, con especialización "
    "tanto en negocios tradicionales de barrio como en negocios digitales de última generación: "
    "e-commerce, creadores de contenido, rent to rent e inversión inmobiliaria). "
    "Tu objetivo es generar contenido de alto valor práctico, claro y cercano para LinkedIn "
    "dirigido a autónomos, pymes y emprendedores de cualquier sector en España."
)

# ---------------------------------------------------------------------------
# NORMATIVA_PROMPT
# Used to generate a LinkedIn post from a BOE / regulatory entry.
# Placeholders (filled at runtime via .format()):
#   {titulo}        - headline of the BOE document
#   {seccion}       - BOE section (e.g. "I - Leyes")
#   {departamento}  - issuing ministry / body
#   {fecha}         - official date string
#   {boe_id}        - document identifier (e.g. BOE-A-2024-12345)
#   {texto}         - first ~2 000 chars of the document text
#   {sector}        - detected sector tag (from relevance scorer)
#   {sector_hashtags} - suggested additional hashtags for this sector
# ---------------------------------------------------------------------------

NORMATIVA_PROMPT = """\
Genera un post de LinkedIn detallado y de alto valor a partir de la siguiente entrada del BOE. \
Sigue el formato EXACTO indicado. El post debe estar completamente en español y redactado en un tono profesional, útil y cercano.

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

=== FORMATO OBLIGATORIO ===
1. Primera línea: emoji 🔔 seguido de un título llamativo de MÁXIMO 8 palabras \
   que capture la esencia del cambio normativo.
2. Un bloque de 2-4 líneas explicando detalladamente QUÉ ha cambiado de forma sencilla y directa.
3. Seción "Cómo te afecta:" con 2-4 bullets usando → (flecha), cada uno en una línea. \
   Desarrolla cada bullet en profundidad con ejemplos reales de cómo afecta en la práctica (plazos, importes, tramos, obligaciones, etc.).
4. Una línea con "📅 Entrada en vigor:" y la fecha efectiva.
5. Una línea con "📎 Fuente: BOE {boe_id}".
6. Una pregunta interactiva final para invitar al debate y comentarios con la audiencia (ej: "¿Qué opinas de esta nueva obligación?", "¿Crees que esta medida ayudará realmente a tu negocio?").
7. Última línea: sin hashtags (no se añaden hashtags).
8. Justo después del post, añade una propuesta de encuesta para que se pueda copiar y crear directamente en LinkedIn:
   📊 Encuesta LinkedIn Sugerida:
   Pregunta: [Tu pregunta de encuesta corta y directa, max 120 caracteres]
   Opciones:
   1) [Opción 1]
   2) [Opción 2]
   3) [Opción 3]

=== RESTRICCIONES ===
- Longitud TOTAL del post (excluyendo la encuesta sugerida) máxima: 2100 caracteres. La encuesta sugerida puede ocupar hasta 400 caracteres adicionales.
- Tono: claro, práctico, cercano. Prohibido usar jerga fiscal abstracta sin explicarla inmediatamente de forma sencilla.
- Escrito en primera persona del plural (nosotros/nuestro) o dirigiéndote directamente al lector (tú/tu negocio).
- NO utilices código markdown especial en negritas o cursivas que no sea compatible con LinkedIn estándar.
- Desarrolla el tema con rigor normativo pero con un lenguaje accesible para cualquier autónomo o pequeña pyme.
- No incluyas ninguna llamada a la acción comercial o promocional, ni ganchos de contacto como 'si tienes dudas escríbeme', 'te ayudamos', 'contacta con nosotros'. El objetivo del post debe ser exclusivamente informativo y de valor, sin intenciones de captar clientes directos.
- ⚠️ RIGOR EN FISCALIDAD INTERNACIONAL: Si el tema involucra fiscalidad internacional (cambio de residencia fiscal, convenios de doble imposición, estructuras offshore, tributación de expatriados, directivas UE, precios de transferencia, country-by-country reporting, Pilar 2 OCDE), DEBES:
  a) Citar únicamente fuentes de máxima autoridad: BOE, AEAT, OCDE, EUR-Lex, Tribunal Supremo, TEAC o grandes despachos como Garrigues.
  b) Usar lenguaje de alta precisión técnica y evitar simplificaciones que puedan inducir a error.
  c) Siempre advertir que este tipo de decisiones requieren asesoría profesional individualizada.
  d) No afirmar ventajas fiscales sin mencionar también los requisitos y riesgos legales asociados.

Devuelve ÚNICAMENTE el texto del post y la encuesta sugerida, sin comentarios introductorios ni explicaciones adicionales.
"""

# ---------------------------------------------------------------------------
# ACTUALIDAD_PROMPT
# Used to generate a LinkedIn post from a press / news article.
# Placeholders:
#   {titulo}        - article headline
#   {resumen}       - article summary / first paragraphs
#   {url}           - article URL
#   {fuente}        - media name (e.g. "Expansión")
#   {fecha}         - publication date
#   {sector}        - detected sector tag
#   {sector_hashtags} - suggested hashtags
# --------------------------------------------------------------------------

ACTUALIDAD_PROMPT = """\
Genera un post de LinkedIn detallado, reflexivo y altamente adaptado a partir de la siguiente noticia de actualidad. \
Sigue el formato EXACTO indicado. El post debe estar en español y reflejar la perspectiva de Alberto López, gestor contable y fiscal en MyTaxBot.

=== DATOS DE LA NOTICIA ===
Titular: {titulo}
Resumen/Texto completo: {resumen}
Fuente: {fuente}
Fecha: {fecha}
URL: {url}
Sector principal: {sector}

=== ENFOQUE DE ADAPTACIÓN (CRÍTICO) ===
Si la noticia es de carácter tecnológico o de innovación (por ejemplo, sobre Inteligencia Artificial, nuevos softwares de gestión, automatización o digitalización de procesos):
- NO te limites a resumir o copiar/pegar los aspectos técnicos o teóricos de la noticia.
- Debes reenfocar y conectar esa tecnología directamente con los sectores de interés de los clientes de Alberto: autónomos de a pie, comercios, tiendas online (e-commerce), creadores de contenido o gestión de alquileres / inversión inmobiliaria (como rent-to-rent o flipping house).
- Ejemplo práctico: Si la noticia trata sobre una nueva IA que redacta contratos o gestiona inquilinos, enfoca el post (especialmente la sección de "Qué significa para ti" y la opinión de Alberto) en cómo un emprendedor de rent-to-rent puede implementarlo para automatizar el trato con inquilinos, reducir horas de gestión y optimizar su facturación.
- Traduce los conceptos abstractos y técnicos a un beneficio o impacto operacional, contable o fiscal real y cotidiano para el negocio de nuestros lectores.

=== FORMATO OBLIGATORIO ===
1. Primera línea: emoji 💡 seguido de un titular conversacional (no el titular original; reescríbelo para que suene como una pregunta o reflexión cercana de Alberto).
2. Un bloque de 3-5 líneas de contexto: explica los detalles de la noticia de forma clara y didáctica para autónomos y pymes que no tengan conocimientos fiscales previos.
3. Sección "Qué significa para ti:" con 2-4 bullets usando → que detallen de forma práctica el impacto en autónomos, comercios o pymes (según aplique).
4. Un bloque de 3-5 líneas con la opinión y reflexión profesional de Alberto (basada en su experiencia diaria, compartiendo una advertencia, consejo o recomendación constructiva sobre el tema).
5. Una línea con "🔗 Fuente: {fuente}" (sin incluir la URL completa en el texto).
6. Una pregunta interactiva final para invitar al debate y comentarios con la audiencia (ej: "¿Te habías enterado de esta ayuda?", "¿Cómo piensas gestionar esta nueva situación?").
7. Última línea: sin hashtags (no se añaden hashtags).
8. Justo después del post, añade una propuesta de encuesta para que se pueda copiar y crear directamente en LinkedIn:
   📊 Encuesta LinkedIn Sugerida:
   Pregunta: [Tu pregunta de encuesta corta y directa, max 120 caracteres]
   Opciones:
   1) [Opción 1]
   2) [Opción 2]
   3) [Opción 3]

=== RESTRICCIONES ===
- Longitud TOTAL del post (excluyendo la encuesta sugerida) máxima: 2100 caracteres. La encuesta sugerida puede ocupar hasta 400 caracteres adicionales.
- Tono: profesional, analítico, cercano y constructivo.
- NO copies textualmente el titular original.
- NO añadas la URL completa en el cuerpo del texto del post.
- Asegúrate de incluir datos numéricos, fechas o plazos de la noticia si figuran en el resumen provisto.
- No incluyas ninguna llamada a la acción comercial o promocional, ni ganchos de contacto como 'si tienes dudas escríbeme', 'te ayudamos', 'contacta con nosotros'. El objetivo del post debe ser exclusivamente informativo y de valor, sin intenciones de captar clientes directos.
- ⚠️ RIGOR EN FISCALIDAD INTERNACIONAL: Si el contenido proviene de fuentes especializadas (como Garrigues, Fixcal, Nómadas Fiscales, Legal Today fiscalidad internacional, OCDE) o trata de residencia fiscal, doble imposición, estructuras societarias, Ley Beckham, régimen de impatriados o impuesto de salida (exit tax), DEBES:
  a) Mantener máximo rigor técnico y exactitud en los datos normativos citados.
  b) Explicar los conceptos sin perder precisión: el lector debe obtener información veraz aunque compleja.
  c) Dejar SIEMPRE claro que estas estrategias requieren análisis personalizado por un asesor fiscal cualificado.
  d) No presentar como "sencillas" o "fáciles" estrategias que tienen requisitos muy exigentes (p.ej. 183 días de residencia efectiva, justificación de actividad real, riesgo de simulación, etc.).

Devuelve ÚNICAMENTE el texto del post y la encuesta sugerida, sin comentarios introductorios ni explicaciones adicionales.
"""

# ---------------------------------------------------------------------------
# RELEVANCE_PROMPT
# Classifies a BOE entry or news article and returns JSON.
# Placeholders:
#   {tipo}    - 'norma_boe' | 'noticia_prensa'
#   {titulo}  - headline or document title
#   {texto}   - first ~1 000 chars of content
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
- 1-4: Sin relevancia para autónomos o pymes españolas.

Nota especial para sector fiscal_internacional: Usar este sector cuando el contenido trate sobre residencia fiscal, convenios de doble imposición, estructuras internacionales, Ley Beckham, Pillar 2 OCDE, exit tax, o análisis de jurisdicciones (Andorra, Emiratos, Malta, Chipre, etc.). Este sector se trabaja con máximo rigor.

=== URGENCIA ===
- alta: Entrada en vigor en los próximos 30 días, o plazo de solicitud de ayuda inminente.
- media: Plazo de 1 a 6 meses, o cambio relevante pero sin urgencia administrativa.
- baja: Consulta tributaria, previsiones futuras, opinión o debate sin fecha o plazo regulado.

Devuelve SOLO el JSON, sin texto extra.
"""
