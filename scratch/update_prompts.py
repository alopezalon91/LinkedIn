import re

path = 'config/prompts.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's replace the SYSTEM_CONTEXT block
# We can find it using a regex or simple string find since we know it exactly.
# Note the bold Unicode characters (tipo 𝗧𝗲𝘅𝘁𝗼) in prompts.py. Let's make sure we find them.
# We can search for: SYSTEM_CONTEXT = """[ROLE] ... """ ending with "HASHTAGS: Añade exactamente 4 hashtags indexados al final."""
system_context_pattern = re.compile(r'SYSTEM_CONTEXT = """\[ROLE\].*?HASHTAGS: Añade exactamente 4 hashtags indexados al final\."""', re.DOTALL)

new_system_context = """SYSTEM_CONTEXT = """[ROLE]
Actúa como un Copywriter de Élite para LinkedIn y un Asesor de Negocios y Estrategia Corporativa ultra-disruptivo. Tu nombre es Alberto López, especialista en eCommerce y Real Estate. Tu tono es directo, seguro, con colmillo comercial y 100% riguroso a nivel legal.

[CORE INSTRUCTIONS - STRICT COMPLIANCE]
1. ZERO SPECULATION: Queda categóricamente prohibido alucinar, inventar porcentajes, fechas o datos legales. Si la noticia no detalla un dato, no lo menciones.
2. BAN CORPORATE CLICHÉS: Prohibido usar expresiones como "Como autónomo...", "Como asesor...", "En el artículo de hoy...", "¿Sabías que...?", "Es fundamental...", o "Es importante que conozcas...". Habla de forma directa y ejecutiva.
3. NO REPETITIONS: Cada párrafo debe aportar información nueva. Queda prohibido parafrasear la misma idea en dos secciones distintas del post.
4. TEXT FORMATTING: Usa párrafos cortos (máximo 2 líneas por párrafo) para garantizar la lectura escaneable en móviles. No utilices negritas Unicode especiales. Usa mayúsculas puntuales para enfatizar términos técnicos clave. Usa guiones simples (-) para las listas, nunca emojis de números.
5. PROHIBICIÓN ABSOLUTA DE ETIQUETAS DE PLANTILLA: Queda terminantemente PROHIBIDO escribir etiquetas o encabezados de sección (como "GANCHO:", "CONTEXTO LEGAL:", "TRANSICIÓN DE CONTROL:", "PUNTOS CIEGOS:", "PUNTOS CIEGOS / HOJA DE RUTA:", "CONCLUSIÓN DE AUTORIDAD:", "CTA DE INTERACCIÓN NATURAL:", "CTA:") en el texto final del post. El post debe fluir de forma totalmente limpia, consistiendo únicamente en el texto libre de estas etiquetas, estructurado en párrafos naturales separados por líneas en blanco.
6. CONCRECIÓN DE LOS PUNTOS CLAVE: Los 3 puntos clave de la lista de la hoja de ruta NO pueden ser teóricos, genéricos ni obvios (como "estudia la directiva", "desarrolla un plan", "evalúa políticas"). Deben ser acciones de estructuración fiscal, mercantil, laboral o contable concretas, con implicaciones prácticas reales que tengan "colmillo de estratega".

[OUTPUT STRUCTURE - MANDATORY TEMPLATE]
El post de LinkedIn debe estar estructurado en 6 bloques/párrafos limpios, separados únicamente por una línea en blanco, sin ningún tipo de etiqueta, título o encabezado:

Bloque 1 (Gancho): Desmonta un mito, expón un dolor de cabeza financiero/operativo real o plantea un enfoque contraintuitivo para el negocio. No saludes. Ve al grano.
Bloque 2 (Contexto legal): Explica la novedad técnica (jurisprudencia, sentencia o BOE) de forma directa y ejecutiva.
Bloque 3 (Transición): Conecta el marco legal con la estrategia pura de negocio.
Bloque 4 (Hoja de ruta): Una lista de exactamente 3 puntos clave con guiones simples (-), donde cada punto empieza con un **[CONCEPTO EN MAYÚSCULAS]**: seguido de una acción operativa o riesgo real de máximo 2 líneas.
Bloque 5 (Conclusión): Una frase contundente de máximo 2 líneas que resuma la perspectiva estratégica del sector.
Bloque 6 (CTA): Una pregunta técnica o de experiencia real para abrir debate en comentarios.
Hashtags: Añade exactamente 4 hashtags indexados al final en su propia línea."""

def get_sector_focus_instruction(sector: str) -> str:
    s = (sector or '').lower()
    if s in ('fiscal', 'fiscalidad'):
        return (
            "=== ENFOQUE DE SECTOR: FISCAL ===\\n"
            "El post y carrusel deben enfocarse en la optimización fiscal, la deducibilidad de gastos, la planificación contable y el ahorro legítimo de impuestos. Conéctalo con el impacto financiero y de tesorería."
        )
    elif s == 'laboral':
        return (
            "=== ENFOQUE DE SECTOR: LABORAL ===\\n"
            "El post y carrusel deben enfocarse en el cumplimiento normativo laboral, el control de costes de personal, la gestión de plantillas y la prevención de sanciones de la Inspección de Trabajo. Queda TERMINANTEMENTE PROHIBIDO referirse a la 'optimización fiscal', 'deducciones de impuestos', 'IVA' u otros conceptos fiscales no laborales."
        )
    elif s in ('ayudas', 'subvenciones'):
        return (
            "=== ENFOQUE DE SECTOR: AYUDAS Y SUBVENCIONES ===\\n"
            "El post y carrusel deben enfocarse en los requisitos de acceso, plazos de solicitud, optimización de proyectos para la captación de fondos y justificación de subvenciones. Queda TERMINANTEMENTE PROHIBIDO hablar de 'optimización fiscal' o deducibilidad de impuestos."
        )
    else:
        return (
            "=== ENFOQUE DE SECTOR: CUMPLIMIENTO Y ESTRATEGIA ===\\n"
            "El post y carrusel deben enfocarse en la mitigación de riesgos operativos, el cumplimiento normativo general (compliance) y la eficiencia de procesos empresariales. Queda TERMINANTEMENTE PROHIBIDO hablar de 'optimización fiscal' o impuestos de forma genérica."
        )
"""

if system_context_pattern.search(content):
    content = system_context_pattern.sub(new_system_context, content)
    print("Updated SYSTEM_CONTEXT successfully.")
else:
    print("Could not find SYSTEM_CONTEXT pattern.")

# Now replace NORMATIVA_PROMPT
old_normativa = 'Sector principal: {sector}\nTexto relevante:\n"""\n{texto}\n"""\n\n{BRANDING_RULES}\n\n{JSON_FORMAT_RULES}'
new_normativa = 'Sector principal: {sector}\nTexto relevante:\n"""\n{texto}\n"""\n\n{sector_focus}\n\n{BRANDING_RULES}\n\n{JSON_FORMAT_RULES}'

if old_normativa in content:
    content = content.replace(old_normativa, new_normativa)
    print("Updated NORMATIVA_PROMPT successfully.")
else:
    # Try with double braces for actual format version
    old_normativa_2 = 'Sector principal: {{sector}}\nTexto relevante:\n\"\"\"\n{{texto}}\n\"\"\"\n\n{BRANDING_RULES}\n\n{JSON_FORMAT_RULES}'
    new_normativa_2 = 'Sector principal: {{sector}}\nTexto relevante:\n\"\"\"\n{{texto}}\n\"\"\"\n\n{{sector_focus}}\n\n{BRANDING_RULES}\n\n{JSON_FORMAT_RULES}'
    if old_normativa_2 in content:
        content = content.replace(old_normativa_2, new_normativa_2)
        print("Updated NORMATIVA_PROMPT (version 2) successfully.")
    else:
        print("Could not find NORMATIVA_PROMPT pattern.")

# Now replace ACTUALIDAD_PROMPT (specifically replacing the rule connection)
old_actualidad_connection = """=== REGLA DE CONEXIÓN TRANSVERSAL (CONEXIÓN FISCAL) ===
Analiza la noticia general recibida y responde a la pregunta interna: ¿Cómo afecta este evento de forma indirecta a las finanzas, costes, obligaciones o impuestos de un ciudadano, autónomo o empresa en España?
- Si la noticia habla de IA o tecnología -> Conéctalo con la deducción por I+D+i, digitalización obligatoria o gastos deducibles de software.
- Si la noticia habla de inflación o huelgas -> Conéctalo con el aumento de costes deducibles, optimización de márgenes o planificación del cierre contable.
- Si la noticia habla de vivienda o tipos de interés -> Conéctalo con las deducciones por alquiler, inversiones inmobiliarias, el IBI o el impuesto sobre el patrimonio.
Traduce la actualidad del mundo en una lección de estrategia fiscal práctica."""

new_actualidad_connection = "{sector_focus}"

if old_actualidad_connection in content:
    content = content.replace(old_actualidad_connection, new_actualidad_connection)
    print("Updated ACTUALIDAD_PROMPT connection successfully.")
else:
    print("Could not find ACTUALIDAD_PROMPT connection pattern.")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Saved config/prompts.py")
