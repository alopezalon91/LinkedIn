const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "5881a622-1ddf-4653-8220-ea2c60542b32";

const newText = `Dos pensiones de jubilación simultáneas pagadas por la Seguridad Social. Ese es el blindaje financiero real que muchos autónomos pierden por el simple hecho de desconocer las reglas de juego de la pluriactividad.

La normativa vigente permite combinar de forma 100% legal tu historial de cotización del RETA y del Régimen General para cobrar un doble ingreso, siempre que se evite la improvisación en la última etapa de la carrera operativa.

Si has combinado el empleo por cuenta ajena con tu estructura de negocio, delegar tu futuro retiro en la unificación de regímenes a la baja es una negligencia estratégica.

PERIODO MÍNIMO SEPARADO: Acredita al menos 15 años de cotización en cada uno de los regímenes por separado, garantizando que un mínimo de 2 años estén comprendidos dentro de los 15 anteriores al retiro.

PLENA SIMULTANEIDAD: Mantén la situación de alta tanto en el RETA como en el Régimen General en la fecha del hecho causante para acceder de forma automática a la doble prestación ordinaria.

REQUISITO EN BAJA: Asegura haber acumulado un mínimo de 15 años de cotización en situación de pluriactividad a lo largo de tu vida laboral si en el momento de jubilarte ya no estás activo en uno de los sistemas.

La ley abre la puerta para maximizar tu rendimiento tras el retiro, pero el éxito de la doble prestación depende de cómo configures la estrategia de tus bases de cotización antes de ejecutar la solicitud.

¿Has auditado tu vida laboral para comprobar si cumples los años de cotización superpuesta necesarios para consolidar este doble ingreso?

#Autonomos #RETA #SeguridadSocial #JubilacionEstrategica`;

async function main() {
    // Fetch the post
    const res = await fetch(`${API_URL}/posts/${post_id}`, {
        headers: { 'Authorization': `Bearer ${SECRET}` }
    });
    const post = await res.json();

    let contentObj;
    try {
        contentObj = JSON.parse(post.content);
    } catch(e) {
        contentObj = { post: post.content };
    }

    contentObj.post = newText;

    // PATCH it back
    const updateRes = await fetch(`${API_URL}/posts/${post_id}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SECRET}`
        },
        body: JSON.stringify({
            content: JSON.stringify(contentObj)
        })
    });

    if (updateRes.ok) {
        console.log("Successfully updated the post with custom text!");
    } else {
        console.error("Failed to update:", await updateRes.text());
    }
}

main();
