const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "5881a622-1ddf-4653-8220-ea2c60542b32";

const carousel = [
  {
    "slide_type": "cover",
    "pre_title": "JUBILACIÓN ESTRATÉGICA",
    "title": "Cobrar dos pensiones a la vez es 100% legal",
    "subtitle": "No pierdas tus años del Régimen General",
    "bullets": []
  },
  {
    "slide_type": "interior",
    "pre_title": "EL MITO",
    "title": "El salto al RETA no borra tu historial",
    "subtitle": "Evita que unifiquen tu base a la baja",
    "bullets": [
      "Puedes cobrar ambas pensiones simultáneamente",
      "Combina tu historial de autónomo y asalariado",
      "Requiere planificar tu estrategia de cotización"
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "REGLA 1",
    "title": "Periodo Mínimo Separado",
    "subtitle": "Audita tu vida laboral",
    "bullets": [
      "15 años mínimos cotizados en cada régimen por separado",
      "Al menos 2 años dentro de los 15 previos al retiro"
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "REGLA 2",
    "title": "Plena Simultaneidad",
    "subtitle": "La ventaja de la pluriactividad",
    "bullets": [
      "Alta en RETA y Régimen General en el momento del retiro",
      "Hacerlo al cumplir la edad ordinaria exigida",
      "Da acceso automático a la doble prestación"
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "REGLA 3",
    "title": "La Clave Retroactiva",
    "subtitle": "Blindaje si dejas de ser asalariado",
    "bullets": [
      "Aplica si ya no estás de alta en ambos sistemas",
      "Exige superposición de cotizaciones en ambos regímenes",
      "Las cotizaciones deben solaparse durante al menos 15 años"
    ]
  },
  {
    "slide_type": "closing",
    "pre_title": "DEBATE",
    "title": "¿Conocías esta cláusula de superposición?",
    "subtitle": "Déjame tu duda en los comentarios",
    "bullets": []
  }
];

const firstComment = "La planificación fiscal a tiempo te puede salvar miles de euros en la jubilación. Si tienes dudas sobre cómo auditar tu vida laboral, contáctanos.";

async function main() {
    const updateRes = await fetch(`${API_URL}/posts/${post_id}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SECRET}`
        },
        body: JSON.stringify({
            carousel: JSON.stringify(carousel),
            first_comment: firstComment
        })
    });

    if (updateRes.ok) {
        console.log("Successfully added the carousel and first comment!");
    } else {
        console.error("Failed to update:", await updateRes.text());
    }
}

main();
