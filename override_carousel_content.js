const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "5881a622-1ddf-4653-8220-ea2c60542b32";

const carousel = [
  {
    "slide_type": "cover",
    "pre_title": "ACTUALIDAD",
    "title": "DOBLE PENSIÓN NO ES IMPOSIBLE",
    "subtitle": "Combina tus años de cotización en Régimen General y RETA",
    "bullets": []
  },
  {
    "slide_type": "interior",
    "pre_title": "LA CLAVE",
    "title": "PERIODO MÍNIMO SEPARADO",
    "subtitle": "Requisito legal para la doble pensión",
    "bullets": [
      "Debes acreditar al menos 15 años de cotización en cada uno de los regímenes por separado",
      "Un mínimo de 2 años deben estar comprendidos dentro de los 15 años inmediatamente anteriores al retiro",
      "La normativa de la Seguridad Social permite cobrar dos pensiones de jubilación simultáneas"
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "ESCENARIO 1",
    "title": "Plena Simultaneidad",
    "subtitle": "Acceso directo por pluriactividad activa",
    "bullets": [
      "**Alta doble**: Estar de alta de forma simultánea en el RETA y en el Régimen General en la fecha del hecho causante.",
      "**Edad ordinaria**: Haber alcanzado la edad de jubilación obligatoria requerida en cada uno de los sistemas.",
      "**Efecto automático**: Cumpliendo los 15 años en cada régimen, accedes a la doble prestación sin condiciones extra."
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "ESCENARIO 2",
    "title": "La Clave Retroactiva",
    "subtitle": "Qué ocurre si ya estás de baja en un régimen",
    "bullets": [
      "**El punto ciego**: Si al jubilarte ya no cotizas en uno de los dos sistemas, la Seguridad Social tiende a denegar la segunda pensión.",
      "**Solapamiento obligado**: Para salvar el derecho, los 15 años mínimos exigidos en ese régimen deben haberse cotizado al mismo tiempo que el otro.",
      "**Pérdida de cuotas**: Si las cotizaciones fueron sucesivas (no simultáneas), los años se fusionan y pierdes la opción de la doble pensión."
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "ESTRATEGIA",
    "title": "Planificación Operativa",
    "subtitle": "Acciones para blindar tu jubilación",
    "bullets": [
      "**Auditoría de vida laboral**: Analizar los tramos exactos de pluriactividad antes de tomar decisiones de cese.",
      "**Optimización de bases**: Planificar las bases de cotización en la última etapa para maximizar el cálculo de ambas pensiones.",
      "**Rigor temporal**: Asegurar el cumplimiento de los periodos de carencia específicos (2 años dentro de los últimos 15)."
    ]
  },
  {
    "slide_type": "closing",
    "pre_title": "TU TURNO",
    "title": "¿Estás en pluriactividad?",
    "subtitle": "CUÉNTAME TU ESTRATEGIA EN COMENTARIOS",
    "bullets": []
  }
];

async function main() {
    const payload = 'CAROUSEL:' + JSON.stringify(carousel);
    const media_b64 = btoa(unescape(encodeURIComponent(payload)));

    const updateRes = await fetch(`${API_URL}/posts/${post_id}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SECRET}`
        },
        body: JSON.stringify({
            media_base64: media_b64
        })
    });

    if (updateRes.ok) {
        console.log("Successfully updated media_base64!");
    } else {
        console.error("Failed to update:", await updateRes.text());
    }
}

main();
