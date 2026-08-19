const { execSync } = require('child_process');

const content = `Feliz Año Nuevo.

Suena a broma, pero a nivel fiscal hoy es 20 de agosto y acaba de empezar tu año. 

Todo lo que has madrugado, peleado con clientes y facturado desde el 1 de enero hasta ayer por la noche, se ha destinado íntegramente a cumplir con tus obligaciones tributarias y cotizaciones. 

La Fundación Civismo lo acaba de calcular y el dato es contundente: los españoles nos pasamos 231 días al año trabajando exclusivamente para pagar impuestos. Son dos días más que el año pasado.

No ha hecho falta una gran reforma fiscal para llegar a esto. La falta de deflactación del IRPF frente a la inflación hace gran parte del trabajo. Subes el sueldo a tu equipo para que no pierdan poder adquisitivo, pero el salto de tramo hace que la carga fiscal absorba gran parte de ese esfuerzo. Además, el aumento automático de las bases de cotización encarece la contratación antes siquiera de que puedas generar rentabilidad.

Si tienes un salario bruto de unos 32.000 euros, la factura entre IRPF y Seguridad Social supera los 17.000 euros anuales. Más de la mitad de lo que realmente le cuestas a la empresa. 

Y si eres el empresario que asume el riesgo y paga esa nómina, el peso administrativo es enorme. El día a día te convierte casi en un recaudador de impuestos, asumiendo toda la carga operativa y el riesgo de soportar sanciones si hay un simple error al rellenar los modelos trimestrales. 

Trabajas más de medio año para sostener el sistema, y es a partir de hoy cuando empiezas a generar margen real para tu propia cuenta bancaria. 

¿Habías calculado alguna vez cuántos meses trabajas tú en exclusiva para pagar impuestos?

#Impuestos #PresiónFiscal #Autónomos #Empresas #IRPF #GestiónFinanciera`;

const carousel = [
  {"slide_type": "title", "title": "Trabajamos 231 días al año solo para impuestos"},
  {"slide_type": "content", "content": "Hoy, 20 de agosto, es tu Día de Liberación Fiscal. Todo lo facturado desde el 1 de enero ha ido directo a la Administración."},
  {"slide_type": "content", "content": "La inflación es la mayor subida de impuestos. Al no deflactar el IRPF, la subida de salarios se la queda la caja pública."},
  {"slide_type": "content", "content": "Un sueldo bruto de 32.000€ soporta una carga anual de más de 17.000€ entre IRPF y cuotas sociales. Más de la mitad del coste real."},
  {"slide_type": "closing", "title": "¿Cuántos meses trabajas tú en exclusiva para pagar impuestos?"}
];

const mediaBase64 = Buffer.from('CAROUSEL:' + JSON.stringify(carousel)).toString('base64');
const id = 'manual-' + Date.now();
const now = new Date().toISOString();

const sql = `INSERT INTO posts (id, type, sector, status, content, content_edited, source_name, media_base64, created_at, updated_at) VALUES ('${id}', 'actualidad', 'general', 'approved', '${content.replace(/'/g, "''")}', '${content.replace(/'/g, "''")}', 'El Economista (Manual)', '${mediaBase64}', '${now}', '${now}');`;

console.log("Running SQL...");
try {
  const result = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --command="${sql}"`, { encoding: 'utf-8' });
  console.log(result);
} catch (e) {
  console.error(e.stdout || e.message);
}
