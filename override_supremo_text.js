const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = "54fdce0f-585d-4f11-85cc-4e9c147c27a6";

const content_edited = `Asumir que Hacienda puede tumbarte la deducción del IVA de tus proyectos secundarios solo porque aún no facturan lo mismo que tu actividad principal es un error de estrategia fiscal que te está costando dinero.

El Tribunal Supremo acaba de asestar un golpe definitivo al criterio restrictivo de la AEAT, blindando el derecho de los autónomos multinicho a deducirse el IVA de los gastos vinculados a sus actividades secundarias.

Esta sentencia desmonta la práctica habitual de la inspección de fiscalizar la "rentabilidad inmediata" de un segundo negocio para denegar sus deducciones. Para optimizar tu mix de actividades sin levantar alertas innecesarias, tu hoja de ruta exige vigilar tres frentes:

PRUEBA DE AFECTACIÓN: La clave ya no es si la actividad secundaria es rentable o colateral, sino demostrar de forma fehaciente que el gasto está directa y exclusivamente afecto al desarrollo de ese nuevo nicho de negocio.

DEDUCCIÓN DESDE EL DÍA UNO: El Supremo ratifica que el IVA de los bienes o servicios adquiridos para iniciar o potenciar una actividad secundaria es deducible, rompiendo el bloqueo que sufrían muchos autónomos en fase de lanzamiento.

ARBITRAJE DE GASTOS: Esta jurisprudencia blinda la deducibilidad de suministros, herramientas digitales o asesoramiento destinados a diversificar tus líneas de ingresos, siempre que se mantenga una contabilidad analítica impecable.

La optimización fiscal eficaz no consiste en esconder tus proyectos secundarios por miedo a una paralela, sino en aplicar la jurisprudencia del Supremo para defender tu liquidez con datos.

¿Desarrollas varias actividades en tu estructura o has frenado la deducción de ciertos gastos por temor al criterio tradicional de Hacienda? Abrimos debate abajo.

#FiscalidadAutonomos #IVA #TribunalSupremo #EstrategiaFiscal`;

async function run() {
    const res = await fetch(API_URL + '/posts/' + post_id, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SECRET
        },
        body: JSON.stringify({ content_edited })
    });

    if (res.ok) {
        console.log('Successfully updated post content!');
    } else {
        console.error('Failed to update:', await res.text());
    }
}
run();
