const { execSync } = require('child_process');
const fs = require('fs');

const postId = '8e070f4a-c563-4d70-92e7-e6c367df6160';

const carrusel = {
  "slides": [
    {
      "slide_type": "cover",
      "pre_title": "EL DESBLOQUEO",
      "title": "NIF Revocado",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "LA TRAMPA",
      "title": "Limbo societario",
      "bullets": [
        "Un cortafuegos diseñado contra las empresas pantalla que mantiene atrapadas a más de 80.000 mercantiles inactivas",
        "Efecto inmediato: Bloqueo absoluto de pasarelas de pago (Stripe/Paypal) y congelación automática de cuentas corporativas",
        "Parálisis mercantil: El notario no puede elevar a público ningún acto de compraventa ni inscribir la disolución de la entidad"
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "EL FUNDAMENTO",
      "title": "Art. 147 LGT",
      "bullets": [
        "La revocación censal amparada en el Art. 119 del RGAT priva de facto de personalidad jurídica a la empresa en el mercado",
        "Hasta hoy, la AEAT exigía acreditar actividad económica real previa para rehabilitar el código, un absurdo kafkiano si la mercantil está inactiva"
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "EL RIESGO REAL",
      "title": "Derivación patrimonial",
      "bullets": [
        "Responsabilidad Solidaria (Art. 42 LGT): Peligro crítico de trasvase de las deudas vivas de la sociedad al patrimonio personal del administrador",
        "Responsabilidad Subsidiaria (Art. 43 LGT): Riesgo latente por cese de actividad de la empresa sin ejecutar una liquidación formal en el Registro Mercantil"
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "LA ESTRATEGIA",
      "title": "Hoja de ruta clínica",
      "bullets": [
        "1. Auditoría preventiva del estado censal de las filiales zombi de tu estructura antes de recibir la notificación de revocación",
        "2. Regularización exprés de los Modelos 200 (Impuesto sobre Sociedades) omitidos en los últimos ejercicios fiscales",
        "3. Aprovechar la inminente flexibilización procedimental de la DGT para devolver la validez al NIF e instar la extinción al segundo siguiente"
      ]
    },
    {
      "slide_type": "closing",
      "pre_title": "EL IMPACTO",
      "title": "¿Puede tu estructura societaria sobrevivir a una inspección censal de la AEAT?",
      "bullets": []
    }
  ]
};

function btoa_utf8(str) {
    return Buffer.from(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    })).toString('base64');
}

const carouselBase64 = "CAROUSEL:" + btoa_utf8(JSON.stringify(carrusel));
const sqlBase64 = carouselBase64.replace(/'/g, "''");

const query = `UPDATE posts SET media_base64 = '${sqlBase64}' WHERE id = '${postId}';`;

fs.writeFileSync('query_update_carousel_final2.sql', query, 'utf8');

console.log("Running query via file...");
try {
  execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --file=query_update_carousel_final2.sql`, { stdio: 'inherit' });
  console.log("Success!");
} catch(e) {
  console.error("Error executing d1", e);
}
