const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "8df75ca6-69d5-432d-9d10-63fc67a01fdc";

async function run() {
    let carousel = [
  {
    "slide_type": "cover",
    "pre_title": "ACTUALIDAD",
    "title": "Bruselas Reacciona Contra España",
    "subtitle": "La Comisión Europea amplía el expediente sancionador por discriminación fiscal",
    "bullets": []
  },
  {
    "slide_type": "interior",
    "pre_title": "EL PROBLEMA",
    "title": "La Ley de Vivienda: Una Discriminación Fiscal Intolerable",
    "subtitle": "La Comisión Europea denuncia que los últimos parches fiscales no han corregido la ilegalidad",
    "bullets": [
      "La Comisión Europea denuncia que la Ley de Vivienda mantiene una discriminación fiscal intolerable",
      "La discriminación afecta a los inversores no residentes en el mercado de Real Estate",
      "La Comisión Europea ha ampliado formalmente el expediente sancionador abierto contra España"
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "AFECTADOS",
    "title": "Patrimonios Internacionales con Capital Invertido en Ladrillo Español",
    "subtitle": "El escenario operativo exige vigilar tres frentes",
    "bullets": [
      "El triple agresivo de la base: un residente puede reducir su base imponible hasta un 90%",
      "El ultimátum de 2 meses: Europa ha dado un plazo a España para tumbar el criterio discriminatorio",
      "La estrategia de reclamación: los no residentes fundamentarán la devolución de ingresos indebidos sobre autoliquidaciones no prescritas"
    ]
  },
  {
        slide_type: 'interior',
        pre_title: 'QUÉ HACER HOY',
        title: 'Auditoría de Activos',
        subtitle: 'Acciones operativas para patrimonios no residentes',
        bullets: [
            '**Mapeo de carteras**: Identificar de inmediato qué inmuebles residenciales en alquiler están en manos de propietarios de la UE o el EEE.',
            '**Cálculo del impacto**: Cuantificar la brecha fiscal sufrida entre la tributación por ingresos íntegros y las reducciones del IRPF denegadas.',
            '**Control de plazos**: Acotar las autoliquidaciones del IRNR presentadas para asegurar que están dentro del periodo no prescrito.'
        ]
    },
    {
        slide_type: 'interior',
        pre_title: 'ESTRATEGIA',
        title: 'Vía de Reclamación',
        subtitle: 'Cómo activar la devolución de ingresos indebidos',
        bullets: [
            '**Fundamento sólido**: Utilizar la ampliación del expediente de la Comisión Europea como vector jurídico principal del recurso.',
            '**Estructuras societarias**: Paralizar transiciones innecesarias hacia SL locales si el único fin era mitigar el impacto del IRNR directo.',
            '**Planificación fiscal**: Adecuar los flujos de caja y la tributación ante la inminente reforma forzosa de la Ley del IRPF.'
        ]
    },
    {
        slide_type: 'closing',
        pre_title: 'TU TURNO',
        title: '¿Gestionas capital extranjero?',
        subtitle: 'CUÉNTAME TU CASO EN COMENTARIOS',
        bullets: []
    }
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
