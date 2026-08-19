const { execSync } = require('child_process');

const carousel = [
  {"slide_type": "cover", "pre_title": "DATO DEMOLEDOR", "title": "Trabajas gratis hasta el 20 de agosto", "bullets": []},
  {"slide_type": "interior", "pre_title": "EL ESFUERZO FISCAL", "title": "231 días para el Estado", "bullets": ["Todo lo facturado desde el 1 de enero hasta hoy va directo a pagar impuestos y cotizaciones", "A partir de hoy empiezas a generar margen real para ti", "Son dos días más de esfuerzo fiscal respecto al año pasado"]},
  {"slide_type": "interior", "pre_title": "EL IMPACTO", "title": "La inflación hace el trabajo sucio", "bullets": ["No ha hecho falta una reforma fiscal para subirte los impuestos", "La falta de deflactación del IRPF absorbe las subidas de sueldo", "El aumento de bases de cotización ahoga la contratación"]},
  {"slide_type": "interior", "pre_title": "EL CASO PRÁCTICO", "title": "Un sueldo de 32.000€", "bullets": ["La factura de IRPF y Seg. Social supera los 17.000€ anuales", "Más de la mitad del coste real se lo queda la Administración", "Asumes el riesgo y trabajas como recaudador de impuestos"]},
  {"slide_type": "closing", "pre_title": "LA CUESTIÓN", "title": "¿Cuántos meses trabajas tú solo para pagar impuestos?", "bullets": []}
];

const mediaBase64 = Buffer.from('CAROUSEL:' + JSON.stringify(carousel)).toString('base64');

// We update the most recent manual post
const sql = `UPDATE posts SET media_base64 = '${mediaBase64}' WHERE source_name = 'El Economista (Manual)' ORDER BY created_at DESC LIMIT 1;`;

console.log("Updating carousel in DB...");
try {
  const result = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --command="${sql}"`, { encoding: 'utf-8' });
  console.log(result);
} catch (e) {
  console.error(e.stdout || e.message);
}
