import sys
from ai.researcher import verify_news_facts

title = "Seguridad Social admite que la Inspección no pueda entrar al negocio del autónomo"
full_text = """El Tribunal Supremo elevó el domicilio social del negocio a domicilio constitucionalmente protegido La Seguridad Social establece ese matiz en su instrucción para los inspectores La coincidencia del domicilio social y el centro de trabajo no impiden la entrada de la inspección La Inspección de Trabajo y Seguridad Social visita más de 250.000 negocios al año La Dirección del Organismo Estatal de Trabajo y Seguridad Social ha emitido una instrucción para aclarar cómo tendrán que proceder de los inspectores de trabajo tras la sentencia emitida por el Tribunal Supremo (TS) el pasado abril, en la que se impide entrar a los negocios sin autorización judicial previa o consentimiento expreso. El criterio del Supremo impide la entrada a la Inspección de Trabajo sin esta autorización, cuando se trata del domicilio del negocio de los autónomos. Ya que, con ello, extiende el derecho a la inviolabilidad del domicilio privado al domicilio social."""

print("Running fact checking...")
report = verify_news_facts(title, full_text)
print("\n=== FACT CHECK REPORT ===")
print(report)
