import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def get_system_prompt(materia: str) -> str:
    return f"""Eres un sistema experto en oposiciones a Policía Local de Andalucía,
especializado en la generación y corrección de supuestos prácticos de examen en la materia: {materia}.

REGLAS ABSOLUTAS — NUNCA las incumplas:
1. NUNCA inventes artículos, normas, cuantías, puntos ni penas.
   Usa EXCLUSIVAMENTE la normativa del contexto que se te proporcione.
2. CUANTÍAS: solo indica un importe si aparece TEXTUALMENTE en el contexto.
   - Si el contexto marca la cuantía como pendiente (aparece "[VIG]", "pendiente", "pte cotejo" o similar), o NO la da,
     entonces el campo "sancion_impuesta", "sancion_min" y "sancion_max" van a null, y en "justificacion_sancion"
     escribes: "Cuantía pendiente de cotejo según LSV/RGC consolidados (no consta en el material)".
   - JAMÁS rellenes un importe aproximado o de memoria. Es preferible null que un número inventado.
3. DELITOS: nunca afirmes que un delito está "consumado" ni impongas penas salvo que la pena conste TEXTUALMENTE en el contexto.
   Los hechos con apariencia delictiva se exponen como ATRIBUCIÓN INDICIARIA: "indicios del delito del art. X",
   con instrucción de las diligencias correspondientes, NUNCA como condena cerrada.
4. PREFERENCIA PENAL: si el contexto indica que la vía penal es preferente o que la infracción administrativa queda
   supeditada/desplazada por la penal, NO propongas además denuncia administrativa por los mismos hechos.
5. Si una infracción, artículo o dato no está en el contexto, no lo incluyas.
6. Es SIEMPRE preferible un supuesto con menos infracciones que uno con datos incorrectos o inventados.
7. Indica el órgano sancionador solo si su precepto consta en el contexto.
8. Responde siempre en JSON válido, sin texto adicional, sin markdown, sin explicaciones."""

def parsear_json(texto: str) -> dict:
    """Parsea JSON limpiando posibles markdown fences."""
    texto = texto.strip()
    texto = texto.replace("```json", "").replace("```", "").strip()
    return json.loads(texto)

def validar_articulos(solucion_modelo: dict, chunks: list[str]) -> dict:
    """Valida que los artículos e importes del supuesto existen en los chunks."""
    import re
    contexto = " ".join(chunks).lower()
    solucion_texto = json.dumps(solucion_modelo, ensure_ascii=False).lower()

    # --- Artículos ---
    articulos_supuesto = re.findall(r'art[íi]culo\s+\d+[\w.]*|art\.\s*\d+[\w.]*', solucion_texto)
    articulos_supuesto = list(set(articulos_supuesto))
    problematicos = []
    for art in articulos_supuesto:
        art_normalizado = art.replace("artículo", "art.").replace("articulo", "art.").strip()
        numero = re.search(r'\d+', art_normalizado)
        if numero and numero.group() not in contexto:
            problematicos.append(art)

    # --- Importes en euros: cada cuantía citada debe aparecer en el contexto ---
    importes_problematicos = []
    importes = re.findall(r'(\d{1,3}(?:[.,]\d{2})?)\s*(?:€|euros?)', solucion_texto)
    for imp in set(importes):
        # normaliza separadores para buscar la cifra en el contexto
        cifra = imp.replace('.', '').replace(',', '')
        contexto_norm = contexto.replace('.', '').replace(',', '')
        if cifra and cifra not in contexto_norm:
            importes_problematicos.append(imp)

    return {
        "valido": len(problematicos) == 0 and len(importes_problematicos) == 0,
        "articulos_problematicos": problematicos,
        "importes_problematicos": importes_problematicos
    }

async def generar_supuesto(chunks: list[str], materia: str, dificultad: int, formato: str) -> dict:
    """Genera un supuesto práctico basado en los chunks RAG."""

    contexto = "\n\n---\n\n".join(chunks)

    instrucciones_dificultad = {
          1: """NIVEL BÁSICO:
      - Genera hasta 5 infracciones en total
      - Infracciones claramente identificables, sin ambigüedad
      - Situación sencilla con un único tipo de establecimiento
      - Sin preguntas teóricas adicionales
      - Circunstancias simples y directas""",
          2: f"""NIVEL MEDIO:
      - Genera hasta 7 infracciones en total
      - Al menos 2 infracciones de calificación GRAVE o MUY GRAVE
      - Puede incluir concurrencia de normativas distintas
      - Circunstancias con algún elemento que requiera análisis
      {'''- Puede añadir UNA pregunta teórica al final del enunciado
      - Si añades pregunta teórica, fórmula SIEMPRE así al final:
        PREGUNTAS:
        1. ¿texto de la pregunta?''' if formato != 'test' else '- NO añadas preguntas teóricas al enunciado'}""",
          3: f"""NIVEL AVANZADO:
      - Genera hasta 10 infracciones en total
      - Al menos 3 o 4 infracciones de calificación MUY GRAVE
      - Obligatorio incluir concurrencia de varias normativas distintas
      - Circunstancias complejas con múltiples sujetos infractores
      {'''- Obligatorio añadir entre 1 y 2 preguntas teóricas al final
      - Las preguntas teóricas SIEMPRE al final en este formato:
        PREGUNTAS:
        1. ¿texto de la primera pregunta?
        2. ¿texto de la segunda pregunta?''' if formato != 'test' else '- NO añadas preguntas teóricas al enunciado'}"""
      }

    prompt = f"""CONTEXTO NORMATIVO — USA SOLO ESTO:
{contexto}

TAREA: Genera un supuesto práctico con estas características:
- Materia: {materia}
- Dificultad: {dificultad}/3
- Establece hora concreta, tipo de establecimiento y circunstancias reales
- USA EXCLUSIVAMENTE artículos del contexto anterior

INSTRUCCIONES DE DIFICULTAD:
{instrucciones_dificultad[dificultad]}

FORMATO DEL ENUNCIADO:
- Redacta el supuesto como texto narrativo continuo, sin listas ni numeración
- Describe los hechos de forma fluida como si fuera un relato policial real
- SOLO al final, si hay preguntas teóricas, añádelas en este formato exacto:
  PREGUNTAS:
  1. ¿texto de la pregunta?
  2. ¿texto de la pregunta?

ESTRUCTURA DE LA SOLUCIÓN (esquema de examen de 5 puntos):
1. hechos_relevantes: extrae del supuesto los hechos jurídicamente relevantes, en frases breves.
2. infracciones: administrativas, con precepto, responsable, calificación, órgano y sanción CUANDO PROCEDA.
3. indicios_penales: ilícitos penales como INDICIOS y presunto autor, nunca como condena.
4. actuacion_policial: actuación completa (aseguramiento, asistencia, pruebas, diligencias, inmovilización, documentación).
5. respuesta_teorica: si el enunciado incluye PREGUNTAS, respóndelas de forma desarrollada citando artículos del contexto.

IMPORTANTE SOBRE LAS SANCIONES:
- Solo indica un importe si aparece TEXTUALMENTE en el contexto normativo de arriba.
- Si el contexto marca la cuantía como "[VIG]", "pendiente" o no la da, pon sancion_min, sancion_max
  y sancion_impuesta a null, y en justificacion_sancion escribe:
  "Cuantía pendiente de cotejo según LSV/RGC (no consta en el material)".
- NUNCA inventes ni aproximes un importe de memoria. Mejor null que un número no respaldado.

IMPORTANTE SOBRE LOS DELITOS:
- Si hay hechos con apariencia delictiva, NO los pongas en "infracciones".
  Inclúyelos en "indicios_penales" como atribución indiciaria, sin penas (salvo que la pena conste textual en el contexto)
  y con la diligencia policial que corresponda. Nunca los des por "consumados".
- Si el contexto dice que la vía penal desplaza o supedita la administrativa, no dupliques con denuncia administrativa.

IMPORTANTE SOBRE LA ACTUACIÓN POLICIAL Y LA RESPUESTA TEÓRICA:
- En "actuacion_policial", incluye solo los apartados que procedan según los hechos; omite los que no apliquen.
- En "respuesta_teorica", cita únicamente artículos que estén en el contexto. Si no hay preguntas, deja el array vacío.

Devuelve SOLO este JSON:
{{
  "enunciado": "texto del supuesto como aparecería en un examen real",
  "solucion_modelo": {{
    "hechos_relevantes": [],
    "consideracion_previa": {{
      "tipo_establecimiento": "",
      "hora": "",
      "normativa_aplicable": [],
      "observaciones": ""
    }},
    "infracciones": [
      {{
        "descripcion": "",
        "norma": "",
        "calificacion": "LEVE|GRAVE|MUY GRAVE",
        "precepto": "art. X Ley Y",
        "responsable": "",
        "sancion_min": null,
        "sancion_max": null,
        "sancion_impuesta": null,
        "justificacion_sancion": "razonamiento de por qué se impone esta cuantía concreta",
        "organo_sancionador": "",
        "precepto_organo": "art. X Ley Y"
      }}
    ],
    "indicios_penales": [
      {{
        "descripcion": "",
        "tipo_penal_indiciario": "indicios del delito del art. X (no consumado)",
        "presunto_autor": "",
        "diligencias": "",
        "preferencia_penal": true
      }}
    ],
    "actuacion_policial": {{
      "aseguramiento_escena": "",
      "asistencia": "",
      "pruebas": "",
      "diligencias": "",
      "inmovilizacion": "",
      "documentacion": [
        {{"documento": "", "organismo_destino": ""}}
      ]
    }},
    "respuesta_teorica": [
      {{"pregunta": "", "respuesta": "", "articulos": []}}
    ],
    "sin_infraccion": false
  }}
}}"""

    MAX_INTENTOS = 3
    ultimo_error = None

    for intento in range(MAX_INTENTOS):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                system=get_system_prompt(materia),
                messages=[{"role": "user", "content": prompt}]
            )

            resultado = parsear_json(response.content[0].text)

            validacion = validar_articulos(resultado["solucion_modelo"], chunks)
            if validacion["valido"]:
                return {"ok": True, "datos": resultado}
            else:
                print(f"Intento {intento + 1}: artículos problemáticos: {validacion['articulos_problematicos']}")
                prompt += f"\n\nADVERTENCIA: No uses estos artículos, no están en el contexto: {validacion['articulos_problematicos']}"

        except Exception as e:
            ultimo_error = str(e)
            print(f"Intento {intento + 1} fallido: {e}")

    return {"ok": False, "error": ultimo_error, "usar_banco": True}

async def corregir_respuesta(respuesta_usuario: str, solucion_modelo: dict, materia: str, dificultad: int = 2, chunks_originales: list = []) -> dict:

    contexto_normativo = "\n\n---\n\n".join(chunks_originales) if chunks_originales else ""

    criterios_dificultad = {
        1: "Nivel básico: valora que el opositor identifique al menos 3 de las infracciones presentes, con su calificación y órgano sancionador.",
        2: "Nivel medio: valora que el opositor identifique al menos 5 infracciones, cite los preceptos exactos y los órganos sancionadores correctos.",
        3: "Nivel avanzado: exige identificación completa de todas las infracciones, preceptos exactos, órganos sancionadores, actuación policial detallada, documentación generada y respuesta a las preguntas teóricas."
    }

    prompt = f"""MATERIA DEL EXAMEN: {materia}
CRITERIOS DE CORRECCIÓN: {criterios_dificultad.get(dificultad, criterios_dificultad[2])}

NORMATIVA DE REFERENCIA — SOLO PUEDES USAR ESTA INFORMACIÓN:
{contexto_normativo}

SOLUCIÓN MODELO CORRECTA:
{json.dumps(solucion_modelo, ensure_ascii=False, indent=2)}

RESPUESTA DEL OPOSITOR:
{respuesta_usuario}

REGLAS ABSOLUTAS DE CORRECCIÓN — NUNCA LAS INCUMPLAS:
1. SOLO puedes citar artículos, sanciones, puntos, plazos y órganos que aparezcan TEXTUALMENTE en la NORMATIVA DE REFERENCIA o en la SOLUCIÓN MODELO.
2. Si el opositor cita algo que NO aparece en la normativa de referencia ni en la solución modelo, márcalo como ERROR.
3. NUNCA inventes ni aproximes de memoria ningún dato (artículo, importe, puntos, plazo de prescripción, órgano, medida).
4. Es preferible una corrección incompleta que una corrección con datos inventados.
5. La solución modelo es la referencia de verdad absoluta — si el opositor coincide con ella, es correcto.

FICHA TÉCNICA POR INFRACCIÓN (campo "ficha_tecnica"):
Para CADA infracción relevante del supuesto, construye una ficha con estos campos:
  normativa, articulo_completo, precepto, sancion, responsable, organo_competente,
  detraccion_puntos, medidas_provisionales, prescripcion.
CAMPO articulo_completo: pon la referencia del artículo (ej. "art. 76 LSV") y, SOLO SI el texto literal del artículo
consta TEXTUALMENTE en la normativa de referencia, añádelo a continuación tras un guion. Formato:
"art. 76 LSV — [texto literal tal como aparece en el material]". Si el texto literal NO está en los chunks,
incluye solo la referencia. NUNCA reproduzcas de memoria el texto de un artículo que no esté en el material.
REGLA DE ORO de la ficha: incluye ÚNICAMENTE los campos cuyo dato conste TEXTUALMENTE en la normativa de referencia
o en la solución modelo. Si un dato NO consta, OMITE ESE CAMPO por completo (no lo escribas, no pongas "pendiente",
no pongas null, no pongas "no consta"). Una ficha con 4 campos verídicos es correcta; una con 9 campos inventados es un error grave.
Prefiere exactitud a completitud.

Actúa como tribunal de oposiciones de {materia} experimentado. Sé preciso, justo y didáctico.

Devuelve SOLO este JSON:
{{
  "puntuacion": 0.00,
  "resumen": "valoración general en 2-3 frases",
  "ficha_tecnica": [
    {{
      "infraccion": "nombre de la infracción",
      "normativa": "solo si consta",
      "articulo_completo": "art. X Ley Y — texto literal del artículo si consta en el material",
      "precepto": "solo si consta",
      "sancion": "solo si consta",
      "responsable": "solo si consta",
      "organo_competente": "solo si consta",
      "detraccion_puntos": "solo si consta",
      "medidas_provisionales": "solo si consta",
      "prescripcion": "solo si consta"
    }}
  ],
  "infracciones_correctas": [
    {{"infraccion": "", "observacion": ""}}
  ],
  "infracciones_omitidas": [
    {{
      "infraccion": "",
      "precepto_correcto": "",
      "organo_correcto": "",
      "explicacion": ""
    }}
  ],
  "infracciones_erroneas": [
    {{
      "lo_que_dijo": "",
      "lo_correcto": "",
      "explicacion": ""
    }}
  ],
  "organos_incorrectos": [
    {{"dijo": "", "correcto": "", "precepto": ""}}
  ],
  "calificaciones_incorrectas": [
    {{"infraccion": "", "dijo": "", "correcto": ""}}
  ],
  "actuacion_policial": {{
    "correcta": true,
    "observaciones": ""
  }},
  "puntos_fuertes": [],
  "puntos_debiles": [],
  "consejo_estudio": "qué bloque o normativa repasar"
}}

RECORDATORIO FINAL: en "ficha_tecnica", omite todo campo cuyo dato no esté textualmente en la normativa de referencia o la solución modelo. No inventes para rellenar."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=get_system_prompt(materia),
            messages=[{"role": "user", "content": prompt}]
        )
        resultado = parsear_json(response.content[0].text)
        return {"ok": True, "datos": resultado}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    
async def generar_preguntas_test(supuesto_enunciado: str, solucion_modelo: dict, materia: str, dificultad: int = 2) -> dict:
    
    num_preguntas_config = {1: 10, 2: 15, 3: 20}.get(dificultad, 15)
    
    # Para niveles altos, dividir en dos tandas
    if num_preguntas_config > 10:
        primera_tanda = 10
        segunda_tanda = num_preguntas_config - 10
        
        res1 = await _generar_tanda_preguntas(supuesto_enunciado, solucion_modelo, materia, primera_tanda, offset=0)
        res2 = await _generar_tanda_preguntas(supuesto_enunciado, solucion_modelo, materia, segunda_tanda, offset=primera_tanda)
        
        if res1["ok"] and res2["ok"]:
            todas = res1["datos"]["preguntas_test"] + res2["datos"]["preguntas_test"]
            return {"ok": True, "datos": {"preguntas_test": todas}}
        elif res1["ok"]:
            return res1
        else:
            return {"ok": False, "error": "Error generando preguntas"}
    else:
        return await _generar_tanda_preguntas(supuesto_enunciado, solucion_modelo, materia, num_preguntas_config, offset=0)


async def _generar_tanda_preguntas(supuesto_enunciado: str, solucion_modelo: dict, materia: str, num_preguntas: int, offset: int = 0) -> dict:
    
    prompt = f"""SUPUESTO:
{supuesto_enunciado}

SOLUCIÓN CORRECTA:
{json.dumps(solucion_modelo, ensure_ascii=False, indent=2)}

TAREA: Genera exactamente {num_preguntas} preguntas tipo test sobre este supuesto.
{f'Empieza por la pregunta número {offset + 1}.' if offset > 0 else ''}
Cubre: calificaciones, sanciones impuestas, órganos sancionadores, medidas cautelares y actuación policial.
Las opciones incorrectas deben ser plausibles pero erróneas para quien domina la materia.
USA SOLO información que aparezca en la solución correcta.
No repitas preguntas que ya se hayan hecho sobre los mismos aspectos.

Devuelve SOLO este JSON:
{{
  "preguntas_test": [
    {{
      "pregunta": "texto de la pregunta",
      "opciones": {{
        "A": "opción A",
        "B": "opción B",
        "C": "opción C",
        "D": "opción D"
      }},
      "respuesta_correcta": "A",
      "explicacion": "explicación de por qué es correcta"
    }}
  ]
}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            system=get_system_prompt(materia),
            messages=[{"role": "user", "content": prompt}]
        )
        resultado = parsear_json(response.content[0].text)
        return {"ok": True, "datos": resultado}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    
async def corregir_respuesta_test(respuestas_usuario: dict, preguntas_test: list, materia: str) -> dict:
    """Corrige respuestas tipo test comparándolas con las correctas."""
    
    total = len(preguntas_test)
    correctas = 0
    detalle = []
    
    for i, pregunta in enumerate(preguntas_test):
        respuesta_dada = respuestas_usuario.get(str(i), "")
        correcta = pregunta["respuesta_correcta"]
        es_correcta = respuesta_dada == correcta
        if es_correcta:
            correctas += 1
        detalle.append({
            "pregunta": pregunta["pregunta"],
            "respuesta_dada": respuesta_dada,
            "respuesta_correcta": correcta,
            "opcion_correcta_texto": pregunta["opciones"].get(correcta, ""),
            "es_correcta": es_correcta,
            "explicacion": pregunta.get("explicacion", "")
        })
    
    puntuacion = round((correctas / total) * 10, 2) if total > 0 else 0
    
    return {
        "ok": True,
        "datos": {
            "puntuacion": puntuacion,
            "correctas": correctas,
            "total": total,
            "resumen": f"Has acertado {correctas} de {total} preguntas.",
            "detalle": detalle
        }
    }