const fs = require('fs');
const path = require('path');

const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const DASHBOARD_SECRET = "d5a8fb21e7d97b0a790518d6bc1f9b3e";

const rawText = `
[DATOS_NOTICIA_REAL]
- ÓRGANO JURÍDICO: Tribunal Supremo (Sala de lo Contencioso-Administrativo).
- CRITERIO CORREGIDO: Se tumba la doctrina tradicional de la Agencia Tributaria (AEAT). Hacienda denegaba sistemáticamente la deducción de las cuotas de IVA soportadas en actividades secundarias si estas no habían comenzado a generar ingresos o si la actividad principal era la única que facturaba.
- NUEVA DOCTRINA FIJADA: El Supremo dictamina que el derecho a deducir el IVA nace desde el momento en que se realizan gastos de inversión para una actividad económica (sea principal o secundaria). No se exige como condición obligatoria que dicha actividad genere ingresos desde el primer día, siempre que se demuestre una intención real de explotación mediante elementos objetivos.
- CASO CONCRETO DE REFERENCIA: Gastos de acondicionamiento y mantenimiento de un activo (ej. embarcación destinada a alquiler turístico/charter) integrado como actividad secundaria de un autónomo que ya opera en otro sector. Hacienda pretendía anular el IVA porque el barco aún no había facturado nada en ese ejercicio.
- REQUISITOS OPERATIVOS EXIGIDOS AL AUTÓNOMO:
  1. Alta censal previa en el modelo 036/037 reflejando el epígrafe de la actividad secundaria.
  2. Acreditación de la condición previa de empresario/profesional (el sujeto ya realiza una actividad económica).
  3. Conservación y justificación de pruebas materiales y documentales (facturas correctas, contratos, planes de viabilidad) que vinculen directamente el gasto soportado con la futura actividad secundaria.
- IMPACTO FINANCIERO: Alivio inmediato en el flujo de caja para empresarios que diversifican o invierten en nuevas líneas de negocio (eCommerce, Real Estate, etc.), evitando que Hacienda retenga miles de euros de IVA durante las fases de desarrollo o pérdidas iniciales.
`;

async function main() {
    // Read the prompts file and manually cut the strings
    const promptsPy = fs.readFileSync('config/prompts.py', 'utf8');
    
    // Quick string splitting to get the exact parts
    const brandingPart = promptsPy.split('BRANDING_RULES = """\\')[1].split('"""')[0];
    const jsonPart = promptsPy.split('JSON_FORMAT_RULES = """\\')[1].split('"""')[0].replace(/{{/g, '{').replace(/}}/g, '}');
    let normativaPart = promptsPy.split('NORMATIVA_PROMPT = f"""\\')[1].split('"""')[0];

    // Replace the placeholders
    normativaPart = normativaPart.replace('{BRANDING_RULES}', brandingPart);
    normativaPart = normativaPart.replace('{JSON_FORMAT_RULES}', jsonPart);
    
    // Replace the Python f-string variables
    normativaPart = normativaPart.replace('{titulo}', 'Deducción IVA en actividades secundarias (Tribunal Supremo)');
    normativaPart = normativaPart.replace('{seccion}', 'Jurisprudencia');
    normativaPart = normativaPart.replace('{departamento}', 'Tribunal Supremo');
    normativaPart = normativaPart.replace('{fecha}', 'Reciente');
    normativaPart = normativaPart.replace('{boe_id}', 'TS-IVA-2026');
    normativaPart = normativaPart.replace('{sector}', 'fiscal');
    normativaPart = normativaPart.replace('{texto}', rawText);

    console.log("PROMPT LENGTH:", normativaPart.length);

    const draftData = {
        prompt: normativaPart
    };

    const payload = {
        type: "normativa",
        sector: "fiscal",
        status: "draft",
        content: JSON.stringify(draftData),
        source_id: "ts-iva-inversiones-" + Date.now(),
        source_name: "Tribunal Supremo (Manual)",
        urgency: "alta",
        ai_score: 10,
        source_url: "#DRAFT_B64=" + Buffer.from(JSON.stringify(draftData)).toString('base64')
    };

    console.log("Sending POST to create draft...");
    const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DASHBOARD_SECRET}`
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        const post = await res.json();
        console.log(`Successfully created draft post! ID: ${post.id}`);
        
        console.log("Triggering generation via Worker (this will use Gemini and save correctly)...");
        const actionRes = await fetch(`${API_URL}/posts/${post.id}/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHBOARD_SECRET}`
            }
        });
        if (actionRes.ok) {
            console.log("Successfully generated post from draft!");
        } else {
            console.error("Failed to generate post:", await actionRes.text());
        }
    } else {
        console.error("Failed to create draft:", await res.text());
    }
}

main().catch(console.error);
