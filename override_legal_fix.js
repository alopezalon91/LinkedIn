const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "5881a622-1ddf-4653-8220-ea2c60542b32";

const newText = `Pensar que por dar el salto al RETA estás condenado a perder los años de cotización que acumulaste como asalariado en el Régimen General es un error financiero gravísimo.

La normativa de la Seguridad Social permite de forma 100% legal cobrar dos pensiones de jubilación simultáneas, combinando tu historial como autónomo y como empleado, siempre que dejes de lado la improvisación y juegues con las reglas del sistema.

Para consolidar esta doble estructura de ingresos y generar derecho propio en cada régimen sin que la Administración te unifique las cotizaciones a la baja, debes auditar tu vida laboral bajo tres condiciones obligatorias:

PERIODO MÍNIMO SEPARADO: Debes acreditar al menos 15 años de cotización en cada uno de los regímenes por separado, garantizando que un mínimo de 2 años estén comprendidos dentro de los 15 años inmediatamente anteriores al retiro.

PLENA SIMULTANEIDAD: Si en el momento de jubilarte estás en situación de alta tanto en el RETA como en el Régimen General (pluriactividad), y cumples la edad ordinaria exigida, accedes automáticamente a la doble prestación.

LA CLAVE RETROACTIVA: Si al solicitar la jubilación ya no estás de alta en uno de los dos sistemas, perderás la segunda pensión a menos que demuestres pluriactividad previa: la ley exige que los 15 años mínimos exigidos en ese régimen se hayan cotizado de forma simultánea y superpuesta en el tiempo con el otro régimen.

La ley te abre la puerta para maximizar tu jubilación, pero el éxito de la doble prestación depende de cómo planifiques la estrategia de tus bases de cotización en la última etapa de tu carrera operativa.

¿Conocías esta cláusula de superposición de 15 años para blindar tu doble pensión si dejas de ser asalariado antes de tiempo? Abrimos debate en comentarios.

#Fiscalidad #Autonomos #RETA #JubilacionEstrategica`;

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
      "Si ya no estás de alta en ambos sistemas",
      "Exige demostrar pluriactividad previa real",
      "Los 15 años mínimos de ese régimen deben superponerse al 100% con el otro"
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
            content: newText,
            content_edited: newText,
            carousel: JSON.stringify(carousel),
            first_comment: firstComment
        })
    });

    if (updateRes.ok) {
        console.log("Successfully fixed the post with legal rigor!");
    } else {
        console.error("Failed to update:", await updateRes.text());
    }
}

main();
