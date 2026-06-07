const { execSync } = require('child_process');

function runWranglerCommand(args) {
  try {
    const output = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "${args.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    return JSON.parse(output);
  } catch (err) {
    console.error(`Wrangler command failed for query: ${args}`);
    console.error(err.stderr || err.message);
    throw err;
  }
}

const updates = {
  // Post 1: Inspección de domicilio
  "637f3464-41c5-4b56-bf26-4dc7019c5714": {
    slides: [
      {
        idx: 0,
        title: "TU NEGOCIO NO ES UN 'TODO VALE' PARA LA INSPECCIÓN",
        subtitle: "La Seguridad Social blinda legalmente el domicilio social del autónomo: límites claros a la entrada"
      },
      {
        idx: 1,
        title: "Inviolabilidad de tu Oficina",
        subtitle: "La entrada sin permiso judicial es inconstitucional"
      },
      {
        idx: 2,
        title: "Autónomos en su Domicilio",
        subtitle: "El blindaje legal de tu casa u oficina habitual"
      },
      {
        idx: 3,
        title: "Exige Autorización Judicial",
        subtitle: "Qué hacer si un inspector llama a tu puerta"
      },
      {
        idx: 4,
        title: "Defiende tu Domicilio Fiscal",
        subtitle: "Estrategia práctica ante abusos burocráticos"
      }
    ]
  },
  // Post 2: Segunda Oportunidad y Sanciones
  "65458623-0193-44e6-b1ea-9fb89764e8c9": {
    slides: [
      {
        idx: 0,
        title: "HACIENDA NO PUEDE FRENAR TU SEGUNDA OPORTUNIDAD",
        subtitle: "Un fallo histórico redefine el perdón de deudas para autónomos con sanciones"
      },
      {
        idx: 1,
        title: "El Veto Ilegal de Hacienda",
        subtitle: "La trampa de sumar sanciones para excluirte"
      },
      {
        idx: 2,
        title: "Fallo Judicial de la Audiencia",
        subtitle: "El revés judicial a la interpretación abusiva"
      },
      {
        idx: 3,
        title: "Autónomos Beneficiados",
        subtitle: "Quiénes pueden exigir la exoneración ahora"
      },
      {
        idx: 4,
        title: "Exige la Exoneración Completa",
        subtitle: "Usa este precedente para limpiar tu historial"
      }
    ]
  },
  // Post 3: Solve et Repete y Bonus
  "a9b30a2c-2d91-42f2-9f33-4166a7d3936d": {
    slides: [
      {
        idx: 0,
        title: "HACIENDA: EL JUEGO DEL 'PAGA PRIMERO' Y LOS 1.000 MILLONES PERDIDOS",
        subtitle: "Tu liquidez, rehén de un sistema que pierde más de la mitad de sus batallas judiciales"
      },
      {
        idx: 1,
        title: "La Asfixia del 'Paga Primero'",
        subtitle: "El secuestro de tu liquidez bajo el Solve et Repete"
      },
      {
        idx: 2,
        title: "Inspectores Incentivados",
        subtitle: "Bonus de productividad vs solidez jurídica"
      },
      {
        idx: 3,
        title: "Frena la Exigencia de Pago",
        subtitle: "La importancia de recurrir y defender tu caja"
      },
      {
        idx: 4,
        title: "Activa la Suspensión Cautelar",
        subtitle: "Estrategias prácticas para proteger tu liquidez"
      }
    ]
  }
};

async function main() {
  console.log("Fetching pending posts from D1 database...");
  const queryResult = runWranglerCommand("SELECT id, media_base64 FROM posts WHERE status = 'pending'");
  const rows = queryResult[0].results || [];

  for (const row of rows) {
    const postUpdate = updates[row.id];
    if (!postUpdate) {
      console.log(`Skipping post ${row.id}: no update details defined.`);
      continue;
    }

    console.log(`\nUpdating post ${row.id}...`);
    try {
      const decodedStr = decodeURIComponent(escape(atob(row.media_base64)));
      if (!decodedStr.startsWith("CAROUSEL:")) {
        console.log("Skipping: media_base64 does not start with CAROUSEL:");
        continue;
      }

      const carousel = JSON.parse(decodedStr.substring(9));
      
      // Apply updates to slides
      postUpdate.slides.forEach(su => {
        if (carousel[su.idx]) {
          console.log(`  Slide ${su.idx+1}: "${carousel[su.idx].title}" -> "${su.title}"`);
          carousel[su.idx].title = su.title;
          carousel[su.idx].subtitle = su.subtitle;
        }
      });

      // Encode and save
      const newCarouselStr = 'CAROUSEL:' + JSON.stringify(carousel);
      const newMediaB64 = btoa(unescape(encodeURIComponent(newCarouselStr)));

      runWranglerCommand(`UPDATE posts SET media_base64 = '${newMediaB64}' WHERE id = '${row.id}'`);
      console.log(`Successfully updated post ${row.id} in D1 database!`);

    } catch (err) {
      console.error(`Error updating post ${row.id}:`, err.message);
    }
  }

  console.log("\nAll pending posts manually fixed successfully.");
}

main();
