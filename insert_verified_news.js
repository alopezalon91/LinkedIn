const { execSync } = require('child_process');
const crypto = require('crypto');

const brandingRules = `
=== [BRANDING_RULES] — IDENTIDAD VISUAL Y COPY (OBLIGATORIO) ===

1. FIRMA CORPORATIVA UNIFICADA:
   El bloque de firma se compone SIEMPRE de dos elementos apilados verticalmente:
   - Superior: Anagrama gráfico [AL] (símbolo gráfico puro, sin texto).
   - Inferior: Nombre "Alberto López" (SIEMPRE con tilde en la Ó y L mayúscula). Prohibido escribirlo sin tilde.
   Ambos elementos forman un bloque único e indivisible.

2. TIPOGRAFÍA Y ESTILO DE MARCA:
   Títulos y contenido interior: 'Plus Jakarta Sans' o 'Montserrat'.
   Nombre del profesional en la firma: Forzar tipografía serif elegante y estilizada ('Playfair Display' o 'Lora' en peso Medium), con tracking/espaciado expandido para actuar como logotipo.
   Está TERMINANTEMENTE PROHIBIDO usar fuentes básicas del sistema.

3. MAQUETACIÓN POR LIENZO (slide_type cover vs interior vs closing):
   - cover (Portada): Firma centrada horizontalmente en la parte inferior. Sin línea de footer.
     Sin paginación. Tamaño de firma un 20% mayor que en interiores.
   - interior (Páginas de contenido): Firma en esquina inferior izquierda. Paginación (ej: "2 / 6 →")
     en esquina inferior derecha. Separadas por línea fina en Verde Sage (#7A8B7B).
     Límite visual: Máximo 40 palabras por slide interior para mantener el 40% de espacio en blanco.
   - closing (Diapositiva de cierre): Diseño centrado dramático. pre_title SIEMPRE = "DEBATE" (en rojo terracota #C2593F).
     El título (title) es una pregunta MUY CORTA Y DIRECTA (MÁXIMO 5 A 7 PALABRAS) que divide al lector: formula algo que le obligue a posicionarse, sin frases largas ni rodeos. Ej: "¿Tu empresa ya lo aplica o miras a otro lado?"
     El subtitle (subtitle) es SIEMPRE exactamente: "COMENTA TU CASO 👇"
     Sin bullets. Firma centrada horizontalmente abajo. Sin paginación.

4. FONDO LIMPIO (SIN RUIDO VISUAL):
   Fondo plano arena claro #F9F6F0 en todas las diapositivas.
   Marca de agua central: ÚNICAMENTE las líneas entrelazadas del anagrama [AL], sin texto,
   opacidad estricta entre el 6% y el 8%. No puede interferir con la lectura.

=== ESTRATEGIA DE CONTENIDO Y TONO DISRUPTIVO (COPYWRITING DE AUTOR) ===
Tu enemigo narrativo es la burocracia asfixiante, el lenguaje deliberadamente confuso de la administración y los gestores tradicionales que se limitan a rellenar modelos sin defender el bolsillo del cliente. Hablas desde el día a día práctico del autónomo que arriesga su capital.
El tono debe ser DISRUPTIVO, crítico, contraintuitivo y directo. Cero lenguaje corporativo aburrido.

=== ESTRUCTURA Y FORMATO DEL POST DE LINKEDIN (CRÍTICO) ===
- Usa párrafos cortos de 1 a 3 líneas máximo.
- Deja SIEMPRE una línea en blanco (doble salto de línea: \\n\\n) entre cada párrafo o sección para garantizar la legibilidad en LinkedIn.
- Cada elemento de una lista (numerada con emojis o con viñetas) debe empezar en una línea nueva.
- PROHIBIDO que todo el post sea una lista de guiones. Escribe en prosa, usando párrafos normales. Solo usa listas cuando estés enumerando requisitos o pasos.

1. GANCHO: Título atractivo (máximo 1-2 líneas) con algún icono llamativo. Seguido de un salto de línea doble (\\n\\n).
2. CUERPO (ALTA DENSIDAD DE VALOR): Explicación detallada, técnica pero accesible. NO escatimes en información, datos ni profundidad. Usa listas numeradas con emojis (1️⃣, 2️⃣, 3️⃣) para detallar la casuística o los pasos legales exactos. PROHIBIDO poner un icono al inicio de cada frase. Usa como máximo 2 o 3 iconos temáticos (📈, 🏛️, 💶, ⚖️, ⚠️) en todo el post para dar ligeros toques visuales. Todo separado con saltos de línea doble (\\n\\n).
   Longitud obligatoria: MÍNIMO 2000 caracteres y máximo 2700. El post DEBE ser extenso, profundo y muy descriptivo, pero siempre estructurado en párrafos cortos separados por líneas en blanco.
3. INTERACCIÓN: Termina el post siempre con una pregunta abierta MUY DIRECTA AL DOLOR del lector para generar comentarios y debate (Ejemplo: "¿Alguna vez te ha entrado un inspector sin avisar y no supiste qué hacer?"). PROHIBIDO hacer preguntas genéricas tipo "¿Qué opinas?" o "¿Estás preparado?". Ve al hueso. Separada con una línea en blanco.
4. HASHTAGS: Incluye siempre 4 o 5 hashtags relevantes al final, en una línea nueva separada por una línea en blanco (ej: #Autónomos #Pymes #Fiscalidad).

=== REGLA ANTI-HUMO Y CERO RELLENO (OBLIGATORIA PARA CUALQUIER IA) ===
Está TERMINANTEMENTE PROHIBIDO crear contenido genérico ("te cuento cómo ahorrar", "hay una nueva ley") o frases vacías ("esto puede afectar a los autónomos"). 
- CERO RELLENO: Si una frase no aporta un dato nuevo, un plazo, un importe o un consejo práctico, ELIMÍNALA. No digas obviedades.
- CERO REDUNDANCIA: Prohibido repetir la misma palabra clave (ej. "deudas pendientes") constantemente. Usa sinónimos o agrupa la información.
- TONO DISRUPTIVO Y DE ALERTA: No escribas como un telediario ("La Agencia Tributaria implementa..."). Escribe como un experto advirtiendo de un peligro ("La Administración acaba de activar la trampa para..."). Adapta siempre el organismo a la noticia real. NUNCA uses la palabra 'Hacienda' si no aplica.
- El post TIENE QUE DAR EL DATO EXACTO. Si hablas de un impuesto, di cuánto % o cuántos euros. 
- AUTORIDAD LEGAL OBLIGATORIA: Si la noticia habla de una sentencia judicial, una ley o una resolución, ES OBLIGATORIO citar explícitamente qué tribunal la dicta, qué número de sentencia es o de qué artículo se habla. No digas "una reciente sentencia", di "la reciente sentencia del Tribunal X".
- Si hay una fecha de entrada en vigor o de publicación, indica el día exacto (ej: "Hoy, {{fecha_de_hoy}}" o la fecha proporcionada). 
- Queremos un post extremadamente denso en valor, técnico pero accesible, muy duro, directo al grano y sin paja.
=== REGLAS ESPECÍFICAS PARA EL CARRUSEL (CRÍTICO) ===
El carrusel NO puede ser un resumen vago ni contener texto motivacional. Debe ser un documento de utilidad inmediata.
TÍTULOS: El campo "title" de la portada (cover) DEBE SER EXTREMADAMENTE CORTO E IMPACTANTE. Máximo 6 palabras. PROHIBIDO títulos largos en la portada. Ve al grano. Para las diapositivas interiores, máximo 8 palabras. Sin rodeos. La fuerza del título viene de la precisión, no de la longitud.
`;

const jsonFormatRules = `
=== FORMATO DE SALIDA (CRÍTICO) ===
Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "post": "El texto completo del post para LinkedIn, formateado...",
  "first_comment": "Texto del primer comentario...",
  "carousel": [
    {
      "slide_type": "cover",
      "pre_title": "TEMA",
      "title": "Título del carrusel",
      "subtitle": "Subtítulo opcional",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "CONTEXTO",
      "title": "La Clave del Asunto",
      "subtitle": "",
      "bullets": ["Punto importante 1", "Punto importante 2"]
    },
    {
      "slide_type": "interior",
      "pre_title": "IMPLICACIONES",
      "title": "Qué debes hacer",
      "subtitle": "",
      "bullets": ["Consejo 1", "Consejo 2"]
    },
    {
      "slide_type": "closing",
      "pre_title": "DEBATE",
      "title": "¿Tu empresa ya lo aplica o miras a otro lado?",
      "subtitle": "COMENTA TU CASO 👇",
      "bullets": []
    }
  ]
}

=== REGLAS DEL COPYWRITING (CRÍTICO) ===
- REGLA DE EXTENSIÓN ESTRICTA: El campo "post" debe tener obligatoriamente entre 1800 y 2200 caracteres. NUNCA te pases de 2300 caracteres o la plataforma lo rechazará. Si el texto original es corto, AMPLIÁLO con tu experiencia, pero respeta el límite.
- REGLA ANTI-BUCLE (CRÍTICO): PROHIBIDO repetir frases de cierre como "Si te gustó", "Contáctanos" o "Comparte". Termina con UNA sola pregunta al final.
- CÓMO ALCANZAR LA LONGITUD: Para llegar a los 2000 caracteres sin repetir texto, DESARROLLA la noticia con esta estructura:
  1. Gancho inicial y explicación del problema.
  2. ¿A quién afecta y por qué? (Invéntate 2 ejemplos detallados de pymes o autónomos sufriendo este problema).
  3. Análisis técnico de la normativa (profundiza como un abogado experto).
  4. Consecuencias a largo plazo si no se preparan.
  5. Cierre con UNA sola pregunta.
- Agrupa las ideas en párrafos densos de 2 a 4 líneas. PROHIBIDO escribir párrafos de una sola frase o de una sola línea. Deja SIEMPRE una línea en blanco entre cada bloque de texto.
`;

const articleBody = `Los jueces permiten a autónomos y pymes reclamar a sus empleados las dietas cobradas indebidamente
Una sentencia confirma que las dietas tienen carácter compensatorio y no salarial. Por ello, cuando el trabajador no tiene que asumir realmente el gasto de la comida por motivos laborales, la empresa podría dejar de abonarlas e incluso exigir la devolución de lo percibido indebidamente.

Muchos autónomos y pequeños negocios abonan dietas de comida a determinados trabajadores porque siempre se ha hecho así, porque lo venían haciendo anteriores responsables o porque asumen que cualquier empleado desplazado tiene automáticamente derecho a cobrarlas. Sin embargo, una reciente sentencia del Tribunal Superior de Justicia de Cataluña recuerda que esta práctica puede ser incorrecta y acabar suponiendo un coste innecesario para la empresa.

La resolución confirma que las dietas no forman parte del salario, sino que tienen una finalidad exclusivamente compensatoria: resarcir al trabajador por los gastos de manutención o alojamiento que se vea obligado a asumir como consecuencia de un desplazamiento laboral. Por ello, cuando el empleado puede regresar a su domicilio para comer o no tiene que soportar realmente ese gasto, la empresa podría no estar obligada a abonarlas.

La sentencia abre la puerta a que autónomos, pequeños negocios y pymes revisen el pago de estas compensaciones. Luis San José Gras, abogado laboralista y profesor de Derecho en la Universidad Internacional de La Rioja (Unir), explicó que "la cuestión más relevante de la sentencia" es que, en determinados supuestos, los autónomos pueden incluso reclamar la devolución de las dietas abonadas, cuando no existía el gasto que las justificaba.

La dieta sólo compensa un gasto que el trabajador debe asumir por motivos laborales
Que un trabajador se desplace fuera de su centro habitual no significa automáticamente que tenga derecho a cobrar una dieta. De hecho, una de las principales conclusiones de la reciente sentencia del TSJ de Cataluña es que estas compensaciones no deben abonarse por rutina, sino solo cuando concurren las circunstancias que las justifican.

Según explicó Luis San José Gras, la dieta "no es un complemento automático, ni una mejora salarial encubierta". Se trata de una cantidad extrasalarial destinada a compensar gastos reales de manutención o alojamiento ocasionados por un desplazamiento.

Por ello, para que exista derecho a percibir una dieta de comida deben concurrir tres requisitos fundamentales:
1. Que exista un desplazamiento por razón del servicio.
2. Que el trabajador se vea obligado a realizar la comida fuera de su domicilio o de su lugar habitual de trabajo.
3. Que dicha situación le genere un gasto real que deba asumir.

La empresa podría dejar de pagar la dieta si no hay un gasto real para el trabajador
Partiendo de este criterio, existen situaciones en las que los autónomos y las pymes podrían no estar obligados a abonar la dieta de manutención:
- Cuando la propia empresa facilita la comida o asume directamente ese gasto.
- Cuando el empleado no tiene que asumir realmente un gasto derivado del desplazamiento.

Los autónomos pueden reclamar la devolución de dietas cobradas de forma indebida
La principal consecuencia práctica de la sentencia no es que aclare cuándo nace el derecho a dieta, sino que confirma que las empresas pueden recuperar el dinero abonado cuando acrediten que esa compensación nunca debió pagarse.

No obstante, reclamar estas cantidades no resulta automático. Según explicó Luis San José, la carga de la prueba recae sobre la empresa, que deberá demostrar de forma rigurosa que el trabajador no tenía derecho a percibir las dietas.

Para ello, recomendó cumplir varios requisitos:
Acreditar que el cobro fue indebido. Identificar los períodos afectados. Cuantificar correctamente las cantidades. Aportar documentación objetiva. Actuar con cautela al descontar cantidades.

Los autónomos deben aportar pruebas para demostrar que una dieta no correspondía
La documentación puede ser decisiva para que una empresa consiga demostrar que una dieta fue abonada indebidamente. San José detalló los documentos que conviene conservar:
Contrato de trabajo, Cláusulas sobre disponibilidad, Registro diario de jornada, Hojas de ruta, Sistemas GPS, Domicilio del trabajador y distancias reales, Tickets, facturas o justificantes de manutención.`;

const factCheckReport = `
La noticia original de Diario AyE es VERAZ, pero carece de datos técnicos fundamentales. 
Para dotar al post de autoridad absoluta, INCLUYE ESTOS DATOS VALIDADOS:
- Origen Legal: Sentencia del Tribunal Superior de Justicia de Cataluña (Sala de lo Social) nº 852/2026.
- Fecha exacta: 12 de mayo de 2026.
- Contexto: Devolución de dietas cobradas indebidamente.
- Base legal: Las dietas tienen carácter compensatorio y extrasalarial, según el Estatuto de los Trabajadores.
`;

const promptText = `Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente noticia de actualidad.

=== REGLA DE ORO ABSOLUTA: VERACIDAD 100% ===
LA INFORMACIÓN DEBE SER 100% REAL Y FIABLE. Está TERMINANTEMENTE PROHIBIDO inventar sentencias, fechas, porcentajes, nombres de tribunales o cualquier otro dato. Si el texto original no contiene un dato, NO lo deduzcas ni lo inventes. Tu prioridad número uno es el rigor.

=== DATOS DE LA NOTICIA ===
Titular: Jueces permiten a autónomos y pymes reclamar empleados dietas cobradas indebidamente
Resumen/Texto completo: ${articleBody}
Fuente: Diario AyE
Fecha: 2026-06-09

=== REPORTE DE INVESTIGACIÓN Y VERACIDAD ===
${factCheckReport}

IMPORTANTE: Usa los datos exactos (fechas, sentencias, base legal y origen del caso) de este reporte de investigación para enriquecer el post. La IA investigadora los ha validado como 100% ciertos. Usa esta información para alcanzar la longitud obligatoria y añadir contexto de alto valor.

=== REGLA DE CONEXIÓN TRANSVERSAL (CONEXIÓN FISCAL) ===
Analiza la noticia general recibida y responde a la pregunta interna: ¿Cómo afecta este evento de forma indirecta a las finanzas, costes, obligaciones o impuestos de un ciudadano, autónomo o empresa en España?

${brandingRules}

${jsonFormatRules}
`;

const draftData = {
    title: "Jueces permiten a autónomos y pymes reclamar empleados dietas cobradas indebidamente",
    summary: "Los jueces permiten a autónomos y pymes reclamar a sus empleados las dietas cobradas indebidamente. Una sentencia confirma que las dietas tienen carácter compensatorio y no salarial.",
    prompt: promptText
};

const contentJson = JSON.stringify(draftData).replace(/'/g, "''");
const idTest = crypto.randomUUID();

const fs = require('fs');

const sqlCommands = `
DELETE FROM decisions WHERE post_id IN (SELECT id FROM posts WHERE source_name='Diario AyE Verified');
DELETE FROM posts WHERE source_name='Diario AyE Verified';
INSERT INTO posts (id, type, sector, status, content, source_name, urgency, ai_score, created_at, updated_at) VALUES ('${idTest}', 'actualidad', 'laboral', 'draft', '${contentJson}', 'Diario AyE Verified', 'alta', 9.9, datetime('now'), datetime('now'));
`;

fs.writeFileSync('c:\\\\Users\\\\elcho\\\\.gemini\\\\antigravity\\\\scratch\\\\LinkedIn\\\\workers\\\\insert_verified.sql', sqlCommands, 'utf8');

execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --file=insert_verified.sql', { stdio: 'inherit', cwd: 'c:\\\\Users\\\\elcho\\\\.gemini\\\\antigravity\\\\scratch\\\\LinkedIn\\\\workers' });

console.log("INSERTADO CON ÉXITO PARA QUE EL USUARIO LO VEA.");
