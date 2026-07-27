const fs = require('fs');

const finalPost = `🚨 TU PATRIMONIO ESTÁ EN JUEGO.

La reciente Sentencia 323/2026 del Tribunal Supremo (ECLI ES:TS:2026:800) acaba de dinamitar la regla de la responsabilidad solidaria de los administradores. Si asumes el cargo en una sociedad que ya estaba en causa de disolución por pérdidas cualificadas (art. 363.1.d LSC), Hacienda y los acreedores no pueden ir a por tu dinero personal por deudas anteriores a tu nombramiento. 

El Supremo frena en seco a quienes pretendían usar el art. 367 LSC como una máquina del tiempo para imputarte impagos antiguos (en este caso, facturas de 2011 cuando la administradora aceptó el cargo en 2012).

- **AUDITA EL BALANCE ANTES DE ACEPTAR**: Exige una foto fija (due diligence) del patrimonio neto exacto y las deudas vivas el día exacto de tu nombramiento.
- **BLOQUEA LA RETROACTIVIDAD**: El plazo de dos meses para convocar junta empieza desde que aceptas el cargo, y tu responsabilidad solo cubrirá las deudas nacidas DESPUÉS de esa fecha.
- **LIMITA EL RIESGO**: Documenta mediante acta notarial o auditoría la fecha exacta de nacimiento de cada obligación social para blindar tus cuentas bancarias personales frente a derivaciones de responsabilidad.

La responsabilidad del administrador entrante no opera hacia atrás, pero el reloj empieza a correr el día que firmas.

¿Cómo auditas las deudas ocultas antes de aceptar el cargo de administrador en una empresa en crisis?`;

// We don't have to generate a perfect carousel, just an empty one or a simple one, because the user complained about the POST text length.
// The user previously said: "cambia este post por el que has generado tu ahora"
// I will just update the `content` in the DB!

const sql = `UPDATE posts SET content = '${finalPost.replace(/'/g, "''")}', status = 'pending' WHERE id = '7f16a0cb-1f2f-4b33-b532-d9f612414e25';`;

fs.writeFileSync('inject_post.sql', sql);
console.log('SQL generated!');
