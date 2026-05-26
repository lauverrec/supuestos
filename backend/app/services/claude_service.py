import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Eres un sistema experto en oposiciones a Policía Local de Andalucía, 
especializado en la generación y corrección de supuestos prácticos de examen.

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
    
    prompt = f"""CONTEXTO NORMATIVO — USA SOLO ESTO:
{contexto}

TAREA: Genera un supuesto práctico con estas características:
- Materia: {materia}
- Dificultad: {dificultad}/3
- Formato: {formato}
- Combina 2-3 infracciones concurrentes del contexto
- Establece hora concreta, tipo de establecimiento y circunstancias reales
- USA EXCLUSIVAMENTE artículos del contexto anterior

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
                max_tokens=4000,
                system=SYSTEM_PROMPT,
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


async def corregir_respuesta(respuesta_usuario: str, solucion_modelo: dict) -> dict:
    """Corrige la respuesta del opositor comparándola con la solución modelo."""
    
    prompt = f"""SOLUCIÓN MODELO CORRECTA:
{json.dumps(solucion_modelo, ensure_ascii=False, indent=2)}

RESPUESTA DEL OPOSITOR:
{respuesta_usuario}

Corrige la respuesta del opositor comparándola con la solución modelo.
Actúa como tribunal de oposiciones experimentado. Sé preciso, justo y didáctico.

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
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        
        resultado = parsear_json(response.content[0].text)
        return {"ok": True, "datos": resultado}
        
    except Exception as e:
        return {"ok": False, "error": str(e)},