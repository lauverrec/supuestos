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
1. NUNCA inventes artículos, normas o sanciones. 
   Usa EXCLUSIVAMENTE la normativa del contexto que se te proporcione.
2. Las sanciones siempre con céntimos exactos. 
   Ejemplo correcto: 300,51 € / Ejemplo incorrecto: "300 euros"
3. Siempre indica el órgano sancionador con su precepto exacto.
4. Si una infracción no está en el contexto proporcionado, no la incluyas.
5. Es preferible un supuesto con menos infracciones que uno con artículos incorrectos.
6. Responde siempre en JSON válido, sin texto adicional, sin markdown, sin explicaciones."""

def parsear_json(texto: str) -> dict:
    """Parsea JSON limpiando posibles markdown fences."""
    texto = texto.strip()
    texto = texto.replace("```json", "").replace("```", "").strip()
    return json.loads(texto)

def validar_articulos(solucion_modelo: dict, chunks: list[str]) -> dict:
    """Valida que los artículos del supuesto existen en los chunks."""
    import re
    
    contexto = " ".join(chunks).lower()
    solucion_texto = json.dumps(solucion_modelo).lower()
    
    articulos_supuesto = re.findall(r'art[íi]culo\s+\d+[\w.]*|art\.\s*\d+[\w.]*', solucion_texto)
    articulos_supuesto = list(set(articulos_supuesto))
    
    problematicos = []
    for art in articulos_supuesto:
        art_normalizado = art.replace("artículo", "art.").replace("articulo", "art.").strip()
        numero = re.search(r'\d+', art_normalizado)
        if numero and numero.group() not in contexto:
            problematicos.append(art)
    
    return {
        "valido": len(problematicos) == 0,
        "articulos_problematicos": problematicos
    }

async def generar_supuesto(chunks: list[str], materia: str, dificultad: int, formato: str) -> dict:
    """Genera un supuesto práctico basado en los chunks RAG."""
    
    contexto = "\n\n---\n\n".join(chunks)
    
    instrucciones_dificultad = {
          1: """NIVEL BÁSICO:
      - Genera entre 3 y 5 infracciones en total
      - Infracciones claramente identificables, sin ambigüedad
      - Situación sencilla con un único tipo de establecimiento
      - Sin preguntas teóricas adicionales
      - Circunstancias simples y directas""",
          2: f"""NIVEL MEDIO:
      - Genera entre 6 y 7 infracciones en total
      - Al menos 2 infracciones de calificación GRAVE o MUY GRAVE
      - Puede incluir concurrencia de normativas distintas
      - Circunstancias con algún elemento que requiera análisis
      {'''- Puede añadir UNA pregunta teórica al final del enunciado
      - Si añades pregunta teórica, fórmula SIEMPRE así al final:
        PREGUNTAS:
        1. ¿texto de la pregunta?''' if formato != 'test' else '- NO añadas preguntas teóricas al enunciado'}""",
          3: f"""NIVEL AVANZADO:
      - Genera entre 8 y 10 infracciones en total
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

IMPORTANTE SOBRE LAS SANCIONES:
Para cada infracción fija una sanción concreta (sancion_impuesta) dentro del rango legal.
Ten en cuenta las circunstancias del supuesto para graduarla.
Expresa siempre con céntimos exactos: 450,51 € no "unos 450 euros".

Devuelve SOLO este JSON:
{{
  "enunciado": "texto del supuesto como aparecería en un examen real",
  "solucion_modelo": {{
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
        "sancion_min": 0.00,
        "sancion_max": 0.00,
        "sancion_impuesta": 0.00,
        "justificacion_sancion": "razonamiento de por qué se impone esta cuantía concreta",
        "organo_sancionador": "",
        "precepto_organo": "art. X Ley Y"
      }}
    ],
    "actuacion_policial": [],
    "documentacion": [
      {{
        "documento": "",
        "organismo_destino": ""
      }}
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
        2: "Nivel medio: valora que el opositor identifique al menos 5 infracciones, cite los preceptos exactos, las sanciones con céntimos y los órganos sancionadores correctos.",
        3: "Nivel avanzado: exige identificación completa de todas las infracciones, preceptos exactos, sanciones con céntimos, órganos sancionadores, actuación policial detallada, documentación generada y respuesta a las preguntas teóricas."
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
1. SOLO puedes citar artículos, sanciones y órganos que aparezcan en la NORMATIVA DE REFERENCIA o en la SOLUCIÓN MODELO.
2. Si el opositor cita algo que NO aparece en la normativa de referencia ni en la solución modelo, márcalo como ERROR.
3. Si tú mismo necesitas citar algo para la corrección y NO está en la normativa de referencia, NO lo cites. Escribe "No verificable con la normativa disponible".
4. NUNCA inventes artículos, sanciones ni órganos sancionadores que no estén en la normativa de referencia.
5. Es preferible una corrección incompleta que una corrección con datos inventados.
6. La solución modelo es la referencia de verdad absoluta — si el opositor coincide con ella, es correcto.

Actúa como tribunal de oposiciones de {materia} experimentado. Sé preciso, justo y didáctico.

Devuelve SOLO este JSON:
{{
  "puntuacion": 0.00,
  "resumen": "valoración general en 2-3 frases",
  "infracciones_correctas": [
    {{"infraccion": "", "observacion": ""}}
  ],
  "infracciones_omitidas": [
    {{
      "infraccion": "",
      "precepto_correcto": "",
      "sancion_correcta": "",
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
}}"""

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