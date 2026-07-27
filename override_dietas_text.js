const { execSync } = require('child_process');

const id = '0720950b-133d-4c31-b2e9-138431fff809';

const newText = `📈 La sentencia del Tribunal Superior de Justicia de Cataluña sobre dietas para autónomos y pymes: ¿un cambio de juego? 

Los jueces permiten a autónomos y pymes reclamar a sus empleados las dietas cobradas indebidamente. La reciente Sentencia del TSJ de Cataluña (Sala de lo Social) nº 852/2026, de 12 de mayo, confirma que las dietas tienen carácter compensatorio y no salarial. Por ello, cuando el trabajador no tiene que asumir realmente el gasto de la comida por motivos laborales, la empresa podría dejar de abonarlas e incluso exigir la devolución de lo percibido indebidamente.

Muchos autónomos y pequeños negocios abonan dietas de comida a determinados trabajadores porque siempre se ha hecho así, porque lo venían haciendo anteriores responsables o porque asumen que cualquier empleado desplazado tiene automáticamente derecho a cobrarlas. Sin embargo, esta sentencia recuerda que esta práctica puede ser incorrecta y acabar suponiendo un coste innecesario para la empresa.

La resolución confirma que las dietas no forman parte del salario, sino que tienen una finalidad exclusivamente compensatoria: resarcir al trabajador por los gastos de manutención o alojamiento que se vea obligado a asumir como consecuencia de un desplazamiento laboral. Por ello, cuando el empleado puede regresar a su domicilio para comer o no tiene que soportar realmente ese gasto, la empresa podría no estar obligada a abonarlas.

Esto abre la puerta a que autónomos, pequeños negocios y pymes revisen el pago de estas compensaciones. Luis San José Gras, abogado laboral, destaca la importancia de entender el carácter compensatorio de las dietas y cómo esto puede afectar a las empresas.

Para entender mejor esta sentencia y cómo puede afectar a tu empresa, es importante considerar los siguientes puntos:

1️⃣ Las dietas no son parte del salario, sino una compensación por gastos reales.
2️⃣ La empresa puede dejar de abonar dietas si el trabajador no incurre en gastos reales.
3️⃣ La empresa puede exigir la devolución de dietas cobradas indebidamente.

¿Alguna vez has tenido que lidiar con el pago de dietas para tus empleados y has sentido que no estabas seguro de cómo proceder?

#Autónomos #Pymes #Fiscalidad #Dietas #Compensaciones #Empleo`;

// En SQLite los saltos de línea se pueden poner tal cual en una cadena con comillas simples.
const sqlSafeText = newText.replace(/'/g, "''");
const sql = `UPDATE posts SET content = '${sqlSafeText}' WHERE id = '${id}';`;

require('fs').writeFileSync('C:\\\\Users\\\\elcho\\\\.gemini\\\\antigravity\\\\scratch\\\\LinkedIn\\\\workers\\\\update_text.sql', sql, 'utf8');

execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --file=update_text.sql', { stdio: 'inherit', cwd: 'C:\\\\Users\\\\elcho\\\\.gemini\\\\antigravity\\\\scratch\\\\LinkedIn\\\\workers' });
console.log("Updated successfully!");
