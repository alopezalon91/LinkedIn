const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const DASHBOARD_SECRET = "d5a8fb21e7d97b0a790518d6bc1f9b3e";
const POST_ID = "74ea596c-d00e-49d4-ade1-2903c5b5fff5";

const slides = [
  {
    slide_type: "cover",
    pre_title: "DATO OFICIAL DE HACIENDA",
    title: "Los propios tribunales de Hacienda anulan el 40% de sus liquidaciones",
    bullets: []
  },
  {
    slide_type: "interior",
    pre_title: "LA REALIDAD DE LOS TEAS",
    title: "Casi la mitad de las reclamaciones favorecen a la empresa",
    bullets: [
      "**Corrección estadística recurrente:** Los Tribunales Económico-Administrativos corrigen total o parcialmente 4 de cada 10 actos de la Agencia Tributaria",
      "**Fragilidad jurídica:** Este porcentaje evidencia que un volumen sustancial de liquidaciones y sanciones carece de suficiente solidez probatoria"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "EL RIESGO DE LIQUIDEZ",
    title: "Recurrir no frena el cobro si no aportas garantías inmediatas",
    bullets: [
      "**Suspensión de la ejecución (Arts. 224 y 233 LGT):** La impugnación no suspende el pago salvo que se solicite formalmente y se aporte aval o caución bancaria",
      "**Medidas cautelares (Art. 81 LGT):** Hacienda puede trabar embargos preventivos sobre cuentas y créditos comerciales antes de resolver la reclamación"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "ESTRATEGIA DE DEFENSA",
    title: "Ganar a Hacienda exige desmontar su presunción con prueba documental",
    bullets: [
      "**Carga de la prueba (Art. 105.1 LGT):** La empresa está obligada a probar documentalmente cada hecho sin limitarse a alegaciones genéricas",
      "**Alineamiento doctrinal:** La defensa debe articularse directamente con los criterios de los TEAs para forzar la anulación del expediente"
    ]
  },
  {
    slide_type: "interior",
    pre_title: "EL COSTE DE LA INACCIÓN",
    title: "Pagar por complacencia abre la puerta a revisiones de 4 años",
    bullets: [
      "**Merma de tesorería:** Aceptar una liquidación errónea regala liquidez y consolida una deuda tributaria injustificada que era perfectamente recurrible",
      "**Efecto llamada inspector:** La Administración cruza datos masivos y suele extender la regularización a todos los ejercicios no prescritos"
    ]
  },
  {
    slide_type: "closing",
    pre_title: "CONCLUSIÓN",
    title: "¿Compensa regalar un 40% de liquidaciones recurribles a Hacienda?",
    bullets: []
  }
];

const mediaBase64 = Buffer.from('CAROUSEL:' + JSON.stringify(slides)).toString('base64');

async function main() {
  console.log("Updating post carousel in D1 for post:", POST_ID);
  const res = await fetch(`${API_URL}/posts/${POST_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DASHBOARD_SECRET}`
    },
    body: JSON.stringify({
      media_base64: mediaBase64
    })
  });

  console.log("Status:", res.status);
  const data = await res.json();
  if (res.ok) {
    console.log("✅ Carousel successfully updated on post:", data.id || POST_ID);
  } else {
    console.error("❌ Failed to update carousel:", data);
  }
}

main().catch(console.error);
