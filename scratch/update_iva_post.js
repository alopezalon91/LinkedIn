const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const DASHBOARD_SECRET = "d5a8fb21e7d97b0a790518d6bc1f9b3e";
const POST_ID = "da558cae-d1cc-4dfb-b6fa-77253d2e80fb";

const postContent = `Viajes de negocios, ferias internacionales, alquiler de vehículos o contratación de servicios en Europa... Es habitual que autónomos y pymes españolas soporten importes significativos de IVA fuera de España.

Lo que muchos ignoran es que ese impuesto no es deducible en el Modelo 303 nacional y que la ventana para recuperarlo vence el próximo 30 de septiembre.

Para articular esta recuperación sin contingencias, la dirección financiera debe controlar cuatro claves técnicas:

1. El canal: Modelo 360 (exclusivo para la Unión Europea)

La devolución del IVA soportado en territorio comunitario se rige por la Directiva 2008/9/CE y se tramita telemáticamente mediante el Modelo 360 ante la sede de la AEAT. Hacienda actúa como ventanilla única: remite el expediente a la administración tributaria del Estado donde se devengó el impuesto, que es quien ingresa los fondos. Para terceros países con reciprocidad (como Reino Unido, Suiza o Noruega), este modelo no aplica; debe acudirse directamente ante sus propias agencias fiscales.

2. Plazo improrrogable y doble castigo fiscal (Art. 15.f LIS)

El 30 de septiembre finaliza el plazo para reclamar el IVA del ejercicio anterior. Dejar pasar la fecha no solo extingue el derecho a devolución; la AEAT rechaza que lo contabilices como gasto deducible en Renta o Sociedades. Al ser una pérdida por negligencia o inacción del contribuyente, la doctrina tributaria lo califica como liberalidad no deducible (Art. 15.f LIS), provocando un doble sobrecoste.

3. Asimetría normativa y umbrales mínimos

La deducibilidad no se rige por la ley española, sino por la del país de destino (hostelería o vehículos tienen restricciones distintas en Francia o Alemania). Además, existen importes mínimos de admisión:
• 400 € si solicitas la devolución trimestral (mínimo 3 meses).
• 50 € si la reclamación abarca el año completo.

4. La trampa documental: veto a los tickets (Art. 105.1 LGT)

Bajo la carga de la prueba (Art. 105.1 LGT), las facturas simplificadas o tickets no son válidas; suponen el rechazo fulminante en los Estados miembros. Se exige factura formal completa con desglose de cuotas y acreditar la afección exclusiva a la actividad.

Dejar facturas extranjeras en el cajón no es prudencia: es un drenaje directo de tesorería.

¿Tiene tu departamento financiero un protocolo para auditar y reclamar este IVA antes del 30 de septiembre?

#IVAInternacional #Modelo360 #Tesoreria #Pymes #DireccionFinanciera #Fiscalidad`;

const slides = [
  {
    slide_type: "cover",
    pre_title: "FISCALIDAD INTERNACIONAL",
    title: "Cómo recuperar el IVA internacional antes del 30 de septiembre",
    bullets: []
  },
  {
    slide_type: "interior",
    pre_title: "EL CANAL ADECUADO",
    title: "El IVA en el extranjero no es deducible en el Modelo 303",
    bullets: [
      "**Modelo 360 (exclusivo UE):** La solicitud se tramita telemáticamente ante la AEAT para su remisión al Estado miembro donde se devengó el impuesto",
      "**Terceros países con reciprocidad:** Para Reino Unido, Suiza o Noruega, la tramitación se efectúa directamente ante sus propias agencias fiscales"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "EL CALENDARIO FISCAL",
    title: "Plazo improrrogable: 30 de septiembre",
    bullets: [
      "**Pérdida irreversible:** Si no se presenta antes del 30 de septiembre, se extingue de forma definitiva el derecho a recuperar el IVA del ejercicio previo",
      "**Riesgo en IS / IRPF:** Hacienda puede rechazar computar ese IVA como mayor gasto deducible al calificarlo de liberalidad debida a inacción (Art. 15.f LIS)"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "UMBRALES DE TRAMITACIÓN",
    title: "Importes mínimos para solicitar la devolución",
    bullets: [
      "**Devolución trimestral (mínimo 400 €):** Aplicable para solicitudes que abarquen entre 3 meses y menos de un año natural completo",
      "**Devolución anual (mínimo 50 €):** Aplicable si la reclamación cubre todo el ejercicio natural o el periodo restante del año"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "RIGOR PROBATORIO",
    title: "Invalidez de las facturas simplificadas (Art. 105.1 LGT)",
    bullets: [
      "**Factura formal completa:** Las facturas simplificadas o tickets suponen el rechazo automático en la práctica totalidad de los Estados miembros",
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
  console.log("Updating post content and carousel with refined professional titles for:", POST_ID);
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
    console.log("✅ Post and carousel successfully updated with polished titles:", data.id);
  } else {
    console.error("❌ Failed to update post:", data);
  }
}

main().catch(console.error);
