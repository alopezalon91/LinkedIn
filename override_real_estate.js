const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "8df75ca6-69d5-432d-9d10-63fc67a01fdc";

const carousel = [
  {
    "slide_type":"cover",
    "pre_title":"ACTUALIDAD",
    "title":"Real Estate en apuros",
    "subtitle":"La Comisión Europea contra España",
    "bullets":[]
  },
  {
    "slide_type": "interior",
    "pre_title": "EL PROBLEMA",
    "title": "El Castigo Financiero",
    "subtitle": "Inversores extranjeros perjudicados",
    "bullets": [
      "La Ley de Vivienda permite a los residentes reducir hasta un 90% sus impuestos por alquilar en zonas tensionadas.",
      "Los propietarios de la UE o el EEE quedan totalmente excluidos de este beneficio fiscal.",
      "Se obliga al inversor extranjero a tributar por el IRNR sobre el 100% de sus ingresos íntegros, sin derecho a deducciones."
    ]
  },
  {
    "slide_type": "interior",
    "pre_title": "EL CONFLICTO",
    "title": "El Ultimátum de Europa",
    "subtitle": "Advertencia a la Administración",
    "bullets": [
      "Bruselas activa un plazo de dos meses para que la Administración española elimine esta discriminación fiscal.",
      "El expediente acusa formalmente a España de vulnerar la libre circulación de capitales del Tratado de la UE.",
      "Este escenario abre la vía para reclamar de inmediato la devolución de los impuestos cobrados de más en ejercicios no prescritos."
    ]
  },
  {
    "slide_type":"interior",
    "pre_title":"QUÉ HACER HOY",
    "title":"Estrategia alternativa",
    "subtitle":"No ignores el conflicto",
    "bullets":[
      "Revisa las declaraciones de tus clientes para exigir la devolución de impuestos cobrados de más",
      "Utiliza la ofensiva legal de la Comisión Europea como argumento técnico",
      "Traba un plan de acción para mitigar el impacto del castigo fiscal"
    ]
  },
  {
    "slide_type":"interior",
    "pre_title":"ESTRATEGIA",
    "title":"Recuperación del dinero",
    "subtitle":"Acción inmediata",
    "bullets":[
      "Exige la devolución de los impuestos cobrados de más en las declaraciones de tus clientes",
      "Aprovecha el plazo de los próximos dos meses para tomar medidas",
      "Vigila el calendario para estar al tanto de los próximos pasos de la Comisión Europea"
    ]
  },
  {
    "slide_type":"closing",
    "pre_title":"TU TURNO",
    "title":"¿Estás preparado?",
    "subtitle":"Cuéntame cómo estás aplicando la estrategia para no perder dinero",
    "bullets":[]
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
