function cleanGeneratedPostText(text) {
  if (!text) return '';
  let clean = text.replace(/\r\n/g, '\n');
  const patternsToStrip = [
    /^\s*-\s*GANCHO\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*GANCHO\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*CONTEXTO LEGAL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*CONTEXTO LEGAL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*TRANSICIÓN DE CONTROL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*TRANSICIÓN DE CONTROL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA\s*(\(Lista de \d+ puntos clave\))?\s*:\s*/gim,
    /^\s*PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA\s*(\(Lista de \d+ puntos clave\))?\s*:\s*/gim,
    /^\s*-\s*PUNTOS CIEGOS\s*:\s*/gim,
    /^\s*PUNTOS CIEGOS\s*:\s*/gim,
    /^\s*-\s*HOJA DE RUTA\s*:\s*/gim,
    /^\s*HOJA DE RUTA\s*:\s*/gim,
    /^\s*-\s*CONCLUSIÓN DE AUTORIDAD\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*CONCLUSIÓN DE AUTORIDAD\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*CTA DE INTERACCIÓN NATURAL\s*:\s*/gim,
    /^\s*CTA DE INTERACCIÓN NATURAL\s*:\s*/gim,
    /^\s*-\s*CTA\s*:\s*/gim,
    /^\s*CTA\s*:\s*/gim,
    /^\s*-\s*HASHTAGS\s*:\s*/gim,
    /^\s*HASHTAGS\s*:\s*/gim,
  ];

  let lines = clean.split('\n');
  lines = lines.map(line => {
    let trimmed = line.trim();
    const exactHeaderPatterns = [
      /^-\s*PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA\s*:\s*$/i,
      /^(PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA|HOJA DE RUTA|PUNTOS CIEGOS)\s*:\s*$/i,
      /^-\s*(GANCHO|CONTEXTO LEGAL|TRANSICIÓN DE CONTROL|CONCLUSIÓN DE AUTORIDAD|CTA DE INTERACCIÓN NATURAL|HASHTAGS)\s*:\s*$/i,
      /^(GANCHO|CONTEXTO LEGAL|TRANSICIÓN DE CONTROL|CONCLUSIÓN DE AUTORIDAD|CTA DE INTERACCIÓN NATURAL|HASHTAGS)\s*:\s*$/i,
    ];
    for (const pattern of exactHeaderPatterns) {
      if (pattern.test(trimmed)) {
        return null;
      }
    }
    let newLine = line;
    for (const pattern of patternsToStrip) {
      if (pattern.test(trimmed)) {
        const leadingWhitespace = line.substring(0, line.indexOf(trimmed));
        const rest = trimmed.replace(pattern, '');
        newLine = leadingWhitespace + rest;
        break;
      }
    }
    return newLine;
  });

  return lines
    .filter(l => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const sample = `Las pymes españolas tienen más margen para adaptarse a la nueva ley de transparencia salarial. La Directiva UE 2023/970, publicada en el Diario Oficial de la Unión Europea el 17 de mayo de 2023, obliga a hacer públicos los sueldos de la plantilla. La fecha límite para su implementación era el 7 de junio, pero debido al incumplimiento de España, las empresas tendrán más tiempo para adaptarse. 
- CONTEXTO LEGAL: La Directiva de transparencia salarial implica que las empresas deben comunicar los sueldos de su plantilla, lo que supone un cambio significativo en la gestión de la información laboral.
- TRANSICIÓN DE CONTROL: Esto conecta directamente con la estrategia de negocio, ya que las empresas deben replantear su política de salarios y beneficios para cumplir con la nueva normativa.
- PUNTOS CIEGOS / HOJA DE RUTA: 
  - IMPLEMENTACIÓN DE LA DIRECTIVA: Debes estudiar la Directiva UE 2023/970 y su impacto en tu empresa.
  - COMUNICACIÓN DE SALARIOS: Debes desarrollar un plan para comunicar los salarios de tu plantilla de manera transparente.
  - EVALUACIÓN DE POLÍTICAS: Debes evaluar y ajustar tus políticas de salarios y beneficios para cumplir con la nueva ley.
- CONCLUSIÓN DE AUTORIDAD: La optimización fiscal requiere una estrategia clara y una comprensión profunda de las leyes y regulaciones aplicables.
- CTA DE INTERACCIÓN NATURAL: ¿Cuál es tu mayor desafío para implementar la Directiva de transparencia salarial en tu empresa?
#TransparenciaSalarial #LeyDeTransparencia #PymesEspañolas #DirectivaUE2023970`;

console.log("=== CLEANED TEXT ===");
console.log(cleanGeneratedPostText(sample));
