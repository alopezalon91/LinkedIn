const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "5881a622-1ddf-4653-8220-ea2c60542b32";

const newText = `Pensar que por dar el salto al RETA estás condenado a perder los años de cotización que acumulaste como asalariado en el Régimen General es un error financiero gravísimo.

La normativa de la Seguridad Social permite de forma 100% legal cobrar dos pensiones de jubilación simultáneas, combinando tu historial como autónomo y como empleado, siempre que dejes de lado la improvisación y juegues con las reglas del sistema.

Para consolidar esta doble estructura de ingresos y generar derecho propio en cada régimen sin que la Administración te unifique las cotizaciones a la baja, debes auditar tu vida laboral bajo tres condiciones obligatorias:

PERIODO MÍNIMO SEPARADO: Debes acreditar al menos 15 años de cotización en cada uno de los regímenes por separado, garantizando que un mínimo de 2 años estén comprendidos dentro de los 15 años inmediatamente anteriores al retiro.

PLENA SIMULTANEIDAD: Si en el momento de jubilarte estás en situación de alta tanto en el RETA como en el Régimen General (pluriactividad), y cumples la edad ordinaria exigida, accedes automáticamente a la doble prestación.

LA CLAVE RETROACTIVA: Si al solicitar la jubilación ya no estás de alta en uno de los dos sistemas, la ley te exige un blindaje extra: las cotizaciones de ambos regímenes deben haberse superpuesto y solapado en el tiempo durante al menos 15 años.

La ley te abre la puerta para maximizar tu jubilación, pero el éxito de la doble prestación depende de cómo planifiques la estrategia de tus bases de cotización en la última etapa de tu carrera operativa.

¿Conocías esta cláusula de superposición de 15 años para blindar tu doble pensión si dejas de ser asalariado antes de tiempo? Abrimos debate en comentarios.

#Fiscalidad #Autonomos #RETA #JubilacionEstrategica`;

async function main() {
    // PATCH it back, using ONLY the raw text!
    const updateRes = await fetch(`${API_URL}/posts/${post_id}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SECRET}`
        },
        body: JSON.stringify({
            content: newText,
            content_edited: newText // also update content_edited so the UI picks it up immediately
        })
    });

    if (updateRes.ok) {
        console.log("Successfully fixed the post with raw text!");
    } else {
        console.error("Failed to update:", await updateRes.text());
    }
}

main();
