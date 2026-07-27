const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "d77db611-f9b6-473b-8137-5f70b874c9ff";

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

    // Modify slides 4 and 5 (index 3 and 4)
    carousel[3] = {
        slide_type: 'interior',
        pre_title: 'QUÉ HACER HOY',
        title: 'Mitiga el Impacto',
        subtitle: 'Acciones sobre el flujo de caja inmediato',
        bullets: [
            '**Cálculo de impacto**: Cuantificar el sobrecoste real de 135 € mensuales por cada socio o colaborador en la base mínima.',
            '**Política de socios**: Informar de inmediato a los socios de control y familiares colaboradores sobre la alteración de sus costes fijos.',
            '**Ajuste de tesorería**: Modificar las previsiones de salida de caja mensuales para evitar descuadres en el cierre del trimestre.'
        ]
    };

    carousel[4] = {
        slide_type: 'interior',
        pre_title: 'ESTRATEGIA',
        title: 'Optimización de Costes',
        subtitle: 'Planificación para neutralizar el alza',
        bullets: [
            '**Arbitraje salarial**: Evaluar técnicamente si compensa reducir el salario bruto en favor de dividendos para esquivar la base mínima.',
            '**Provisión de regularización**: Apartar los diferenciales de cuota de forma preventiva ante la regularización definitiva de la Seguridad Social.',
            '**Optimización del mix**: Estructurar el equilibrio óptimo entre rendimientos del trabajo y del capital para los administradores de la SL.'
        ]
    };

    // Modify slide 6 (index 5)
    carousel[5] = {
        slide_type: 'closing',
        pre_title: 'TU TURNO',
        title: '¿Socio o administrador?',
        subtitle: 'CUÉNTAME TU ESTRATEGIA EN COMENTARIOS',
        bullets: []
    };

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
