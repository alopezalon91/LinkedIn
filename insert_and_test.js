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
- El post debe tener una estructura visual muy limpia y aireada, nunca un bloque continuo de texto.

1. GANCHO: Título atractivo (máximo 1-2 líneas) con algún icono llamativo. Seguido de un salto de línea doble (\\n\\n).
2. CUERPO (ALTA DENSIDAD DE VALOR): Explicación detallada, técnica pero accesible. NO escatimes en información, datos ni profundidad. Usa listas numeradas con emojis (1️⃣, 2️⃣, 3️⃣) para detallar la casuística o los pasos legales exactos. PROHIBIDO poner un icono al inicio de cada frase. Usa como máximo 2 o 3 iconos temáticos (📈, 🏛️, 💶, ⚖️, ⚠️) en todo el post para dar ligeros toques visuales. Todo separado con saltos de línea doble (\\n\\n).
   Longitud obligatoria: MÍNIMO 2000 caracteres y máximo 2700. El post DEBE ser extenso, profundo y muy descriptivo, pero siempre estructurado en párrafos cortos separados por líneas en blanco.
3. INTERACCIÓN: Termina el post siempre con una pregunta abierta para generar comentarios y debate, separada con una línea en blanco.
4. HASHTAGS: Incluye siempre 4 o 5 hashtags relevantes al final, en una línea nueva separada por una línea en blanco (ej: #Autónomos #Pymes #Fiscalidad).

=== REGLA ANTI-HUMO Y CERO RELLENO (OBLIGATORIA PARA CUALQUIER IA) ===
Está TERMINANTEMENTE PROHIBIDO crear contenido genérico ("te cuento cómo ahorrar", "hay una nueva ley") o frases vacías ("esto puede afectar a los autónomos"). 
- CERO RELLENO: Si una frase no aporta un dato nuevo, un plazo, un importe o un consejo práctico, ELIMÍNALA. No digas obviedades.
- CERO REDUNDANCIA: Prohibido repetir la misma palabra clave (ej. "deudas pendientes") constantemente. Usa sinónimos o agrupa la información.
- TONO DISRUPTIVO Y DE ALERTA: No escribas como un telediario ("La Agencia Tributaria implementa..."). Escribe como un experto advirtiendo de un peligro ("Hacienda acaba de activar la guillotina para...").
- El post TIENE QUE DAR EL DATO EXACTO. Si hablas de un impuesto, di cuánto % o cuántos euros. 
- Si hay una fecha de entrada en vigor o de publicación, indica el día exacto (ej: "Hoy, {{fecha_de_hoy}}" o la fecha proporcionada). 
- Queremos un post extremadamente denso en valor, técnico pero accesible, muy duro, directo al grano y sin paja.
=== REGLAS ESPECÍFICAS PARA EL CARRUSEL (CRÍTICO) ===
El carrusel NO puede ser un resumen vago ni contener texto motivacional. Debe ser un documento de utilidad inmediata.
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
      "pre_title": "TEMA EN MAYÚSCULAS",
      "title": "El título del carrusel",
      "subtitle": "Un subtítulo opcional",
      "bullets": []
    }
  ]
}
`;

const articleBody = `El Tribunal Supremo elevó el domicilio social del negocio a domicilio constitucionalmente protegido La Seguridad Social establece ese matiz en su instrucción para los inspectores La coincidencia del domicilio social y el centro de trabajo no impiden la entrada de la inspección La Inspección de Trabajo y Seguridad Social visita más de 250.000 negocios al año La Dirección del Organismo Estatal de Trabajo y Seguridad Social ha emitido una instrucción para aclarar cómo tendrán que proceder de los inspectores de trabajo tras la sentencia emitida por el Tribunal Supremo (TS) el pasado abril, en la que se impide entrar a los negocios sin autorización judicial previa o consentimiento expreso. El criterio del Supremo impide la entrada a la Inspección de Trabajo sin esta autorización, cuando se trata del domicilio del negocio de los autónomos. Ya que, con ello, extiende el derecho a la inviolabilidad del domicilio privado al domicilio social. Ello se debe a que es frecuente, en el caso de los pequeños negocios, que el centro de trabajo y el domicilio social coincidan. Y los espacios o la oficina donde se desarrollan los poderes de la dirección están constitucionalmente protegidos para el alto tribunal. Ahora, la dirección del organismo público ha reafirmado este matiz, que era necesario aclarar por la frecuencia con la que concurren las dependencias del domicilio social y el centro de trabajo del negocio. Según aclaró, la Inspección de Trabajo no podrá entrar sin autorización judicial al despacho del titular del órgano de administración o de la alta dirección, la sala de reuniones del Consejo de Administración o la zona de archivos y documentos. El TS aclaró en su doctrina que si el local o el establecimiento del autónomo es también domicilio social no es posible acceder sin ese consentimiento previo. La excepción que se estableció en la sentencia es, justamente, que exista una separación clara y evidente entre la zona del local y la del domicilio social y sea posible limitar las actuaciones a la zona no protegida. Ello se debe a que el Supremo realiza una interpretación favorable del Artículo 18.2 de la Constitución Española, que amplía este derecho a las personas jurídicas con una protección “matizada”. Esto es, que “cubre los espacios donde se dirige la actividad y se custodian los documentos, a salvo de terceros”. Este es el matiz que ha seguido la Dirección del Organismo Estatal de Trabajo y Seguridad Social en su instrucción, que establece un aclaración importante acerca de las pautas que pueden aplicar los inspectores. En el dictamen del TS, las actuaciones inspectoras en el negocio sin autorización judicial o consentimiento previo se produjeron en el marco de unas diligencias relacionadas con otra empresa, añadiendo otro aspecto relevante en el alcance de su criterio. La Seguridad Social establece ese matiz en su instrucción para los inspectores En base a la interpretación que la dirección del organismo público realiza de la sentencia del alto tribunal, no se considera domicilio constitucionalmente protegido los locales comerciales abiertos al público ni los centros en los que se lleva a cabo una actividad laboral, productiva o comercial por cuenta de una sociedad mercantil, “no vinculada con las actividades de dirección de la sociedad ni sirvan a la custodia de su documentación”. Es decir, que los límites a la entrada de los inspectores en los locales o establecimientos de las empresas afectan a determinados espacios concretos, para los que sí se requerirá la autorización judicial previa o la autorización expresa del titular del negocio. Será posible realizar las visitas sin necesidad de autorización cuando se de esa distinción o separación entre el domicilio social y el centro de trabajo. Ahora bien, como también apunta la entidad, “el hecho de que concurra la doble condición de domicilio social de la empresa y de centro de trabajo no impide la realización de la visita”. Por ello, aclara que: En los establecimientos abiertos al público, las visitas se realizarán de forma ordinaria. Estas se producirán en las zonas accesibles del negocio y en aquellos espacios que no constituyan el lugar de dirección de la empresa (almacenes, vestuarios, etcétera). No se consideran domicilio constitucionalmente protegido. En los establecimientos no abiertos al público sujetos a inspección, “cualquiera que sea su naturaleza y configuración espacial y disposición”, permitirán las visitas ordinarias salvo que se trate de aquellas dependencias en las que se lleve a cabo el poder de dirección. Aquí se incluye el despacho del titular del órgano de administración o de la alta dirección de la empresa, la sala de reuniones del Consejo de Administración o la zona de archivos, entre otros. En este caso, la inspección informará expresamente al autónomo de la intención de llevar a cabo la visita “únicamente” en la parte del establecimiento que constituye el centro de trabajo. Esto concuerda con las directrices del Supremo, que apuntan a la distinción física evidente entre la zona de las oficinas del domicilio social y la zona del centro de trabajo, y que establece que los inspectores informen de antemano de que solo van a acceder a la zona de trabajo. La instrucción también subraya que, con independencia del centro de trabajo visitado, si el autónomo se opone a la visita alegando que se trata del domicilio social, el inspector o inspectora le solicitará “justificación de su calificación como tal” y de la delimitación del espacio físico en el que desarrolla la actividad de dirección. Asimismo, según las recomendaciones, si la Inspección de Trabajo se presenta en el negocio y el espacio coincide con su domicilio social, la empresa puede solicitar que se identifique la autorización judicial que permite el acceso y, si no cuenta con ella, "manifestar expresamente que no consiente a la entrada, dejando constancia por escrito si fuera posible", a fin de poder impugnar la actuación más tarde si fuera necesario. Además, es importante no obstaculizar el trabajo de la inspección pese a no contar con la autorización.`;

const promptText = `Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente noticia de actualidad.

=== REGLA DE ORO ABSOLUTA: VERACIDAD 100% ===
LA INFORMACIÓN DEBE SER 100% REAL Y FIABLE. Está TERMINANTEMENTE PROHIBIDO inventar sentencias, fechas, porcentajes, nombres de tribunales o cualquier otro dato. Si el texto original no contiene un dato, NO lo deduzcas ni lo inventes. Tu prioridad número uno es el rigor.

=== DATOS DE LA NOTICIA ===
Titular: Seguridad Social admite que la Inspección no pueda entrar al negocio del autónomo
Resumen/Texto completo: ${articleBody}
Fuente: Diario AyE
Fecha: 2026-06-04
URL: https://www.autonomosyemprendedor.es/articulo/seguridad-social/seguridad-social-admite-que-inspeccion-pueda-entrar-negocio-autonomo-como-decia-supremo/20260604005727054168.html
Sector principal: Seguridad Social

=== REGLA DE CONEXIÓN TRANSVERSAL (CONEXIÓN FISCAL) ===
Analiza la noticia general recibida y responde a la pregunta interna: ¿Cómo afecta este evento de forma indirecta a las finanzas, costes, obligaciones o impuestos de un ciudadano, autónomo o empresa en España?

${brandingRules}

${jsonFormatRules}
`;

const draftData = {
    title: "Seguridad Social admite que la Inspección no pueda entrar al negocio del autónomo",
    summary: "La Seguridad Social ha emitido una instrucción avalando el criterio del Supremo, que impide la entrada en los negocios de los autónomos sin autorización judicial.",
    prompt: promptText
};

const contentJson = JSON.stringify(draftData).replace(/'/g, "''");
const idTest = crypto.randomUUID();
const idUser = crypto.randomUUID();

const fs = require('fs');

const sqlCommands = `
DELETE FROM posts WHERE source_name='Diario AyE';
INSERT INTO posts (id, type, sector, status, content, source_name, urgency, ai_score, created_at, updated_at) VALUES ('${idTest}', 'actualidad', 'laboral', 'draft', '${contentJson}', 'Diario AyE', 'alta', 9.8, datetime('now'), datetime('now'));
INSERT INTO posts (id, type, sector, status, content, source_name, urgency, ai_score, created_at, updated_at) VALUES ('${idUser}', 'actualidad', 'laboral', 'draft', '${contentJson}', 'Diario AyE', 'alta', 9.8, datetime('now'), datetime('now'));
`;

fs.writeFileSync('c:\\\\Users\\\\elcho\\\\.gemini\\\\antigravity\\\\scratch\\\\LinkedIn\\\\workers\\\\insert.sql', sqlCommands, 'utf8');

execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --file=insert.sql', { stdio: 'inherit', cwd: 'c:\\\\Users\\\\elcho\\\\.gemini\\\\antigravity\\\\scratch\\\\LinkedIn\\\\workers' });

console.log("TEST ID: " + idTest);
