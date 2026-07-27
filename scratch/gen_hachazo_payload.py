import base64
import json
import urllib.request
import urllib.parse

# Hachazo Fiscal Carousel JSON
hachazo_slides = [
    {
        "slide_type": "cover",
        "pre_title": "ALERTA BRUSELAS",
        "title": "Hachazo fiscal a inversores extranjeros",
        "subtitle": "",
        "bullets": []
    },
    {
        "slide_type": "interior",
        "pre_title": "LA DISCRIMINACIÓN",
        "title": "Cero deducciones al no residente",
        "subtitle": "",
        "bullets": [
            "Un residente deduce hasta el 90% del alquiler en zonas tensionadas",
            "Al inversor extranjero se le exige tributar por sus ingresos brutos",
            "Discriminación fiscal que destroza la rentabilidad del Real Estate"
        ]
    },
    {
        "slide_type": "interior",
        "pre_title": "EL EXPEDIENTE",
        "title": "Europa interviene contra España",
        "subtitle": "",
        "bullets": [
            "La Comisión Europea amplía la sanción por este castigo fiscal injusto",
            "Freno directo a operaciones de carteras internacionales de alquiler"
        ]
    },
    {
        "slide_type": "interior",
        "pre_title": "EL ULTIMÁTUM",
        "title": "Plazo de dos meses para Hacienda",
        "subtitle": "",
        "bullets": [
            "Bruselas da un aviso definitivo antes de ir a los tribunales europeos",
            "Es obligatorio cambiar la Ley de Vivienda o afrontar multas millonarias"
        ]
    },
    {
        "slide_type": "interior",
        "pre_title": "LA ESTRATEGIA",
        "title": "Exige ya la devolución del dinero",
        "subtitle": "",
        "bullets": [
            "Utiliza esta ofensiva legal como argumento técnico inmediato",
            "Reclama los impuestos cobrados de más en declaraciones no prescritas",
            "Hacienda no devolverá un solo euro de forma automática"
        ]
    },
    {
        "slide_type": "closing",
        "pre_title": "RENTABILIDAD EN RIESGO",
        "title": "¿Dejarás que Hacienda penalice la rentabilidad de tus inversiones?",
        "subtitle": "",
        "bullets": []
    }
]

json_str = json.dumps(hachazo_slides)
payload = "CAROUSEL:" + json_str
encoded = base64.b64encode(payload.encode('utf-8')).decode('utf-8')

# We don't have the exact post ID, so let's use the local pdf_generator to output a PDF directly just to show the user it works,
# OR we can just generate a sql file to update it.
print(encoded)
