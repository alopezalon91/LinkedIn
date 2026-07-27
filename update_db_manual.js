const { execSync } = require('child_process');

const postId = '3e6b15dc-08bb-4d8a-afa7-e40813f4e4d9';

const postText = `La asunción del cargo de administrador en una sociedad en crisis estructural es una trampa mortal si no se audita el pasado con precisión quirúrgica. ⚠️

La reciente Sentencia del Tribunal Supremo 323/2026 marca una línea roja vital sobre la derivación de responsabilidad por deudas societarias. Un administrador entrante que acepta el cargo en una mercantil que ya se encuentra en causa legal de disolución no puede ser condenado a pagar de su bolsillo las deudas que nacieron antes de su nombramiento. El alto tribunal fulmina así la aplicación extensiva y casi automática de la presunción del artículo 367.2 de la Ley de Sociedades de Capital que aplicaban algunos juzgados de lo mercantil.

1️⃣ Escenario de entrada en sociedad zombi: Si asumes la administración de una entidad y descubres que su patrimonio neto está por debajo de la mitad del capital social, la ley te obliga a convocar junta en dos meses. Si incumples, respondes solidariamente. Sin embargo, bajo esta nueva doctrina, si un proveedor te reclama facturas impagadas del ejercicio anterior, tu patrimonio personal queda a salvo porque dichas obligaciones son cronológicamente previas a tu gestión.

2️⃣ Escenario de presunción probatoria inversa: El acreedor siempre intentará utilizar el artículo 367.2 LSC para presumir legalmente que sus créditos nacieron después de tu nombramiento. No obstante, si logras acreditar de forma documental que las facturas tienen fecha anterior a tu aceptación del cargo, esta presunción 'iuris tantum' se desactiva instantáneamente, blindando tu posición como nuevo administrador frente a pasivos heredados.

Este pronunciamiento no es un hecho aislado, sino la consolidación definitiva de la doctrina marcada anteriormente por la STS 601/2019 y la STS 144/2017. Además, el Supremo armoniza inteligentemente su fallo con la reciente reforma introducida por la Ley 16/2022, la cual positivizó esta misma jurisprudencia añadiendo el nuevo artículo 367.3 LSC. Dicho precepto aclara sin margen de duda que el contador temporal de responsabilidad civil arranca exclusivamente desde la aceptación formal del cargo directivo.

A nivel estratégico, esta resolución otorga una seguridad jurídica incalculable a los profesionales de la reestructuración corporativa que entran para reflotar empresas al borde del concurso de acreedores. Exige, eso sí, una diligencia preventiva extrema: la fecha exacta de inscripción en el Registro Mercantil y la auditoría forense de la deuda se convierten en el único escudo válido.

¿Cómo afectará esta jurisprudencia a tu próxima auditoría de riesgos antes de aceptar un cargo directivo?

#DerechoMercantil #ResponsabilidadAdministradores #Jurisprudencia #ComplianceLegal #TribunalSupremo`;

const carrusel = {
  "slides": [
    {
      "slide_type": "cover",
      "pre_title": "JURISPRUDENCIA",
      "title": "EL LÍMITE DEL SUPREMO",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "EL CONTEXTO TÉCNICO",
      "title": "ENTRAR EN UNA EMPRESA EN CRISIS",
      "bullets": [
        "Aceptar el cargo de administrador en una sociedad con pérdidas graves siempre conlleva un riesgo patrimonial inminente.",
        "La Ley de Sociedades de Capital impone responder solidariamente si no se disuelve o se convoca junta en el plazo legal."
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "LA NUEVA SENTENCIA",
      "title": "FRENO A LA RESPONSABILIDAD HEREDADA",
      "bullets": [
        "La STS 323/2026 dicta que el administrador entrante jamás responde de las deudas generadas antes de su nombramiento oficial.",
        "El Tribunal Supremo anula la condena a una administradora por facturas impagadas en el año anterior a su gestión."
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "LA LÍNEA DE DEFENSA",
      "title": "CÓMO ROMPER LA PRESUNCIÓN LEGAL",
      "bullets": [
        "El artículo 367.2 de la LSC presume temporalmente que todas las deudas son posteriores a la causa legal de disolución.",
        "Esta sentencia confirma que aportar documentación acreditando fechas anteriores desactiva la presunción y blinda tu patrimonio."
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "EL MARCO NORMATIVO",
      "title": "AVALADOS POR LA LEY 16/2022",
      "bullets": [
        "El fallo consolida la doctrina previa del Supremo y la alinea perfectamente con las últimas reformas de reestructuración.",
        "El contador de tu responsabilidad como administrador arranca de forma exclusiva desde la firma de aceptación del cargo."
      ]
    },
    {
      "slide_type": "closing",
      "pre_title": "RIESGO PATRIMONIAL",
      "title": "¿ASUMIRÍAS EL CARGO AHORA?",
      "bullets": []
    }
  ]
};

// Encode text properly
function btoa_utf8(str) {
    return Buffer.from(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    })).toString('base64');
}

const carouselBase64 = "CAROUSEL:" + btoa_utf8(JSON.stringify(carrusel));

// Escape properly for bash/SQL
const sqlText = postText.replace(/'/g, "''");
const sqlBase64 = carouselBase64.replace(/'/g, "''");

const query = `UPDATE posts SET content_edited = '${sqlText}', media_base64 = '${sqlBase64}' WHERE id = '${postId}';`;

const fs = require('fs');
fs.writeFileSync('query.sql', query, 'utf8');

console.log("Running query via file...");
try {
  execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --file=query.sql`, { stdio: 'inherit' });
  console.log("Success!");
} catch(e) {
  console.error("Error executing d1", e);
}
