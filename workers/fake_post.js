const { execSync } = require('child_process');
const crypto = require('crypto');

const uuid = crypto.randomUUID();
const timestamp = new Date().toISOString();

const content = `Hacienda acaba de activar la guillotina para todos aquellos que presenten tarde el modelo 303 del IVA. ⚠️

La Agencia Tributaria ha publicado una nueva resolución vinculante que no deja margen de maniobra. Si te retrasas un solo día, te va a caer una multa automática.

1️⃣ Sanción mínima: 3.000 euros de multa sin posibilidad de reducción por pronto pago.
2️⃣ Entrada en vigor: 1 de julio de 2026.
3️⃣ Afectados: Todos los trabajadores por cuenta propia que presenten liquidaciones trimestrales.

No puedes confiar en la suerte ni en que "por un día no pasa nada". Tienes que tener todo documentado y presentado antes de la fecha límite. 💶

¿Estás preparado para este nuevo nivel de exigencia por parte de la Administración?`;

const first_comment = `Fuente: Resolución 45/2026 de 5 de junio, de la Dirección General de Tributos.`;

const sql = `
INSERT INTO posts (id, type, sector, status, content, first_comment, source_id, source_url, source_name, urgency, ai_score, created_at, updated_at) 
VALUES (
  '${uuid}', 
  'noticia_prensa', 
  'fiscalidad', 
  'pending', 
  '${content.replace(/'/g, "''")}', 
  '${first_comment.replace(/'/g, "''")}', 
  'fake-hacienda-303-${Date.now()}', 
  'https://www.agenciatributaria.es', 
  'AEAT', 
  'alta', 
  10.0, 
  '${timestamp}', 
  '${timestamp}'
);
`;

const fs = require('fs');
fs.writeFileSync('insert_fake.sql', sql);

console.log("Running wrangler...");
try {
  const result = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --file=insert_fake.sql');
  console.log(result.toString());
} catch (e) {
  console.error(e.stdout?.toString());
  console.error(e.stderr?.toString());
}
