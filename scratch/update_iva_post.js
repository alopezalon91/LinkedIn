const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const DASHBOARD_SECRET = "d5a8fb21e7d97b0a790518d6bc1f9b3e";
const POST_ID = "da558cae-d1cc-4dfb-b6fa-77253d2e80fb";

const postContent = `Viajes de negocios, ferias internacionales, alquiler de vehículos o formación en Europa... Es habitual que autónomos y pymes españolas paguen IVA fuera de España.

Lo que muchos ignoran es que ese impuesto no se mete en el Modelo 303 y que la ventana para recuperarlo vence el próximo 30 de septiembre.

La clave práctica para no perder ese dinero:

1. El canal: Modelo 360 (exclusivo para la UE)
Se presenta ante la sede de la AEAT, que remite la petición a la administración tributaria del país donde soportaste el impuesto. (Para terceros países con reciprocidad como Reino Unido o Suiza, el trámite se realiza directamente ante sus propias agencias).

2. Plazo improrrogable
El 30 de septiembre finaliza el plazo para reclamar el IVA soportado a lo largo del ejercicio anterior. Dejar pasar la fecha no solo extingue el derecho a devolución; la AEAT puede rechazar que lo contabilices como gasto deducible en Renta o Sociedades por considerarlo una liberalidad debida a inacción.

3. Umbrales mínimos de tramitación
• 400 € si solicitas la devolución trimestral (mínimo 3 meses).
• 50 € si la reclamación abarca el año completo (o lo restante de ejercicio).

4. La trampa documental (Art. 105.1 LGT)
Los tickets o facturas simplificadas no sirven. Los Estados miembros exigen factura formal completa con desglose de IVA y datos fiscales del emisor y receptor, además de acreditar la correlación estricta con la actividad económica.

Dejar facturas extranjeras en el cajón es un drenaje directo de tesorería.

¿Tiene tu departamento financiero un protocolo para auditar y solicitar este IVA antes del cierre de plazo?

#IVAInternacional #Modelo360 #Tesoreria #Pymes #DireccionFinanciera #Fiscalidad`;

const slides = [
  {
    slide_type: "cover",
    pre_title: "FISCALIDAD INTERNACIONAL",
    title: "El IVA extranjero no se mete en el Modelo 303: cómo recuperarlo antes del 30 de septiembre",
    bullets: []
  },
  {
    slide_type: "interior",
    pre_title: "EL CANAL ADECUADO",
    title: "Modelo 360: exclusivo para países de la Unión Europea",
    bullets: [
      "**Ventanilla única AEAT:** La solicitud telemática se presenta en España, pero la resuelve la administración del Estado donde se soportó el impuesto",
      "**Terceros países con reciprocidad:** Para Reino Unido, Suiza o Noruega, la tramitación se efectúa directamente ante sus propias agencias fiscales"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "EL CALENDARIO FISCAL",
    title: "Plazo improrrogable: 30 de septiembre del año siguiente",
    bullets: [
      "**Pérdida irreversible:** Si no se presenta antes del 30 de septiembre, se extingue de forma definitiva el derecho a recuperar el IVA del ejercicio previo",
      "**Riesgo en IS / IRPF:** Hacienda puede rechazar computar ese IVA como mayor gasto deducible al calificarlo de liberalidad debida a negligencia"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "UMBRALES DE TRAMITACIÓN",
    title: "Importes mínimos exigidos para admitir la solicitud",
    bullets: [
      "**Devolución trimestral (mínimo 400 €):** Aplicable para solicitudes que abarquen entre 3 meses y menos de un año natural completo",
      "**Devolución anual (mínimo 50 €):** Aplicable si la reclamación cubre todo el ejercicio natural o el periodo restante del año"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "RIGOR PROBATORIO",
    title: "La trampa documental: los tickets no sirven (Art. 105.1 LGT)",
    bullets: [
      "**Factura formal completa:** Los tickets o facturas simplificadas suponen el rechazo automático e inapelable en casi todos los Estados miembros",
      "**Afección económica:** La empresa debe acreditar documentalmente que el gasto responde en exclusiva a las necesidades de la actividad"
    ]
  },
  {
    slide_type: "closing",
    pre_title: "CONCLUSIÓN",
    title: "¿Audita tu empresa el IVA soportado en el extranjero antes de que expire el plazo?",
    bullets: []
  }
];

const mediaBase64 = Buffer.from('CAROUSEL:' + JSON.stringify(slides)).toString('base64');

async function main() {
  console.log("Updating post content and carousel for:", POST_ID);
  const res = await fetch(`${API_URL}/posts/${POST_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DASHBOARD_SECRET}`
    },
    body: JSON.stringify({
      content: postContent,
      content_edited: postContent,
      media_base64: mediaBase64
    })
  });

  console.log("Status:", res.status);
  const data = await res.json();
  if (res.ok) {
    console.log("✅ Post and carousel successfully updated:", data.id);
  } else {
    console.error("❌ Failed to update post:", data);
  }
}

main().catch(console.error);
