const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "54fdce0f-585d-4f11-85cc-4e9c147c27a6";

async function run() {
    const res = await fetch(API_URL + '/posts/' + post_id, {headers: {'Authorization': 'Bearer ' + SECRET}});
    const post = await res.json();
    
    let carousel = [];
    if (post.media_base64) {
        const decoded = decodeURIComponent(escape(atob(post.media_base64)));
        if (decoded.startsWith('CAROUSEL:')) {
            carousel = JSON.parse(decoded.substring(9));
        } else {
            console.error('Not a CAROUSEL JSON');
            return;
        }
    } else {
        console.error('No media_base64');
        return;
    }

    // Slide 1 (index 0)
    carousel[0].subtitle = 'Hachazo al criterio de la AEAT: Sentencia n.º 612/2026 del Tribunal Supremo.';

    // Slide 4 (index 3)
    carousel[3].bullets = [
        '**Auditar ejercicios no prescritos**: Revisar liquidaciones de los últimos 4 años donde se frenaron deducciones por "actividad secundaria".',
        '**Cuantificar el impacto**: Calcular el IVA y los intereses de demora a reclamar por ingresos indebidos.',
        '**Criterio de prevalencia**: Aplicar el nuevo derecho a la deducción desde la fase de inversión, sin esperar a la rentabilidad.'
    ];

    // Slide 5 (index 4)
    carousel[4].title = 'Blindaje ante Inspección';
    carousel[4].bullets = [
        '**Contabilidad Analítica**: Implementar registros contables separados por tramos de actividad para blindar la trazabilidad del gasto.',
        '**Nexo de Afectación**: Documentar de forma fehaciente que el gasto es exclusivo de la actividad, independientemente de los estatutos.',
        '**Principio de Neutralidad**: Defender que si hay obligación de repercutir IVA, existe el derecho correlativo a deducirlo.'
    ];

    const payload = 'CAROUSEL:' + JSON.stringify(carousel);
    const media_b64 = btoa(unescape(encodeURIComponent(payload)));

    const updateRes = await fetch(API_URL + '/posts/' + post_id, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SECRET
        },
        body: JSON.stringify({ media_base64: media_b64 })
    });

    if (updateRes.ok) {
        console.log('Successfully updated carousel slides!');
    } else {
        console.error('Failed to update:', await updateRes.text());
    }
}
run();
