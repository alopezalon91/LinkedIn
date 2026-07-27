import json
import base64
from ai.pdf_generator import create_carousel_pdf

slides_json = """[
  {
    "pre_title": "ALERTA FISCAL",
    "title": "El SII convierte tus exportaciones en deudas millonarias",
    "subtitle": "Un error de forma que destroza tu rentabilidad",
    "bullets": [],
    "tipo": "portada"
  },
  {
    "pre_title": "EL PELIGRO OCULTO",
    "title": "La trampa de las exportaciones exentas",
    "subtitle": "Declarar mal te cuesta el 21%",
    "bullets": [
      "Operaciones que calificas como exentas.",
      "El SII las registra con error por falta de justificación.",
      "Hacienda reclama el IVA no repercutido."
    ],
    "tipo": "contenido"
  },
  {
    "pre_title": "LA NORMATIVA",
    "title": "El cruce de datos que no perdonan",
    "subtitle": "Intrastat y el DUA son tu sentencia",
    "bullets": [
      "La AEAT cruza el modelo 349 con Intrastat.",
      "Las exportaciones fuera de la UE se cruzan con el DUA.",
      "Si los datos del SII no coinciden al 100%, hay sanción."
    ],
    "tipo": "contenido"
  },
  {
    "pre_title": "EL ERROR COMÚN",
    "title": "Confiar en la factura comercial",
    "subtitle": "No sirve como prueba ante Hacienda",
    "bullets": [
      "Emitir la factura sin IVA no justifica la exención.",
      "Necesitas el documento de transporte internacional.",
      "Sin prueba de salida de mercancía, la exención se anula."
    ],
    "tipo": "contenido"
  },
  {
    "pre_title": "LA SOLUCIÓN",
    "title": "Blindaje documental inmediato",
    "subtitle": "Lo que debes exigir a tu transitario",
    "bullets": [
      "DUA de exportación con la salida efectiva (mensaje 599).",
      "CMR firmado en destino para operaciones en la UE.",
      "Conciliación mensual exacta entre contabilidad, SII y aduanas."
    ],
    "tipo": "contenido"
  },
  {
    "pre_title": "DEFENSA ESTRATÉGICA",
    "title": "¿Vas a dejar que un fallo administrativo arruine tus operaciones internacionales?",
    "subtitle": "",
    "bullets": [],
    "tipo": "cierre"
  }
]"""

slides = json.loads(slides_json)
b64 = create_carousel_pdf(slides)

with open('test_output.pdf', 'wb') as f:
    f.write(base64.b64decode(b64))

print("Done. Saved test_output.pdf")
