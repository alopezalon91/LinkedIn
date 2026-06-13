const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "5881a622-1ddf-4653-8220-ea2c60542b32";

const carousel = [
  {
    "slide_type": "cover",
    "pre_title": "JUBILACIÓN ESTRATÉGICA",
    "title": "¿Cobrar dos pensiones de jubilación a la vez?",
    "subtitle": "El blindaje legal de la pluriactividad",
    "bullets": []
  },
  {
    "slide_type": "interior",
    "pre_title": "REQUISITOS",
    "title": "Las reglas del doble ingreso",
    "subtitle": "Condiciones obligatorias",
    "bullets": [
      "Acredita un mínimo de 15 años de cotización efectivos en el RETA y otros 15 años en el Régimen General.",
      "Garantiza el alta simultánea en ambos regímenes en la fecha exacta del hecho causante del retiro.",
      "Blinda de forma independiente tus bases de cotización para maximizar el cálculo de cada prestación."
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "RIESGOS",
    "title": "El peligro de la baja previa",
    "subtitle": "Cuidado con la pérdida de derechos",
    "bullets": [
      "Acumula 15 años de cotización superpuesta y simultánea a lo largo de tu historial laboral si te jubilas estando de baja en un régimen.",
      "Demuestra este solapamiento temporal exacto ante el INSS para evitar la pérdida automática de tu segunda prestación.",
      "Audita tu vida laboral inmediatamente para comprobar el cumplimiento de esta carencia conjunta obligatoria."
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "ACCIÓN",
    "title": "Hoja de ruta operativa",
    "subtitle": "Pasos para la doble pensión",
    "bullets": [
      "Planifica la estrategia de tus bases de cotización durante los últimos 25 años previos a la edad ordinaria de retiro.",
      "Calcula el impacto financiero real de mantener activa la estructura de pluriactividad en tu etapa de cierre de carrera.",
      "Maximiza el rendimiento de tu jubilación ejecutando la solicitud de forma independiente en cada ventanilla administrativa."
    ]
  },
  {
    "slide_type": "closing",
    "pre_title": "TU TURNO",
    "title": "Protege tu retiro",
    "subtitle": "¿CUMPLES LOS AÑOS DE COTIZACIÓN SIMULTÁNEA NECESARIOS?",
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
