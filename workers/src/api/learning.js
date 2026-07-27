import { nowISO } from '../utils.js';
import { callAIWithFallback } from './posts.js';

/**
 * Analiza la diferencia entre el contenido original y el editado por el usuario,
 * extrae una regla de estilo y la guarda en la base de datos D1.
 */
export async function learnFromEdits(db, env, postId, originalContent, editedContent) {
  if (!originalContent || !editedContent || originalContent === editedContent) return;

  try {
    const prompt = `
      Eres el sistema de aprendizaje de una IA que genera posts para LinkedIn.
      El usuario ha editado un post generado por la IA.
      
      Texto Original:
      ${originalContent}

      Texto Editado por el usuario:
      ${editedContent}

      Analiza qué ha borrado, añadido o modificado el usuario. 
      Extrae UNA única "Regla de Estilo" corta, imperativa y universal (máximo 15 palabras) que resuma la lección principal que la IA debe aplicar en el futuro para escribir más parecido a él. Si los cambios son simples erratas, no generes regla.
      Ejemplo: "Nunca uses la palabra 'multa', usa 'sanción'." o "Evita usar párrafos de más de tres líneas."
      
      Devuelve un JSON con:
      {
        "hasRule": true/false,
        "rule": "Texto de la regla..."
      }
    `;

    const RESPONSE_SCHEMA = {
      type: "object",
      properties: {
        hasRule: { type: "boolean" },
        rule: { type: "string" }
      },
      required: ["hasRule", "rule"]
    };
    const resultJson = await callAIWithFallback(db, env, prompt, "Analiza los textos", "application/json", RESPONSE_SCHEMA);
    const result = JSON.parse(resultJson);
    
    if (result && result.hasRule && result.rule) {
      const ruleId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO style_learnings (id, post_id, rule_text, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(ruleId, postId, result.rule, nowISO()).run();
      
      console.log(`[Machine Learning] Nueva regla aprendida: ${result.rule}`);
    }
  } catch (error) {
    console.error('[Machine Learning] Error al aprender del post:', error);
  }
}
