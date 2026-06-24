from sqlalchemy import text
import os
import re
import json
from sqlalchemy.orm import Session
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def generar_embedding(texto: str) -> list[float]:
    """Genera embedding usando el modelo de Anthropic."""
    # Usamos voyage-3 a través de Anthropic para embeddings jurídicos
    import urllib.request
    import urllib.error
    
    # Por ahora usamos un embedding simple basado en hash para desarrollo
    # En producción se sustituye por Voyage AI
    palabras = texto.lower().split()
    vector = [0.0] * 1536
    for i, palabra in enumerate(palabras[:1536]):
        vector[i % 1536] += hash(palabra) % 1000 / 1000.0
    
    # Normalizar
    magnitud = sum(x**2 for x in vector) ** 0.5
    if magnitud > 0:
        vector = [x / magnitud for x in vector]
    
    return vector

def detectar_tipo(texto: str) -> str:
    """Detecta el tipo de chunk automáticamente."""
    texto_lower = texto.lower()
    if any(p in texto_lower for p in ["infracción", "infraccion", "sanción", "sancion", "multa"]):
        return "infraccion"
    if any(p in texto_lower for p in ["actuación", "actuacion", "agente", "policía", "identificar"]):
        return "actuacion"
    if any(p in texto_lower for p in ["art.", "artículo", "decreto", "ley ", "reglamento"]):
        return "normativa"
    if any(p in texto_lower for p in ["documento", "acta", "diligencia", "informe"]):
        return "documentacion"
    return "general"

def extraer_metadata(texto: str) -> dict:
    """Extrae metadata jurídica del chunk."""
    articulos = re.findall(r'art[íi]culo\s+\d+[\w.]*|art\.\s*\d+[\w.]*', texto, re.IGNORECASE)
    leyes = re.findall(r'Ley\s+\d+\/\d+|Decreto\s+\d+\/\d+|RD\s+\d+\/\d+', texto, re.IGNORECASE)
    return {
        "articulos": list(set(articulos)),
        "leyes": list(set(leyes))
    }

def dividir_en_chunks(texto: str, max_palabras: int = 200, overlap: int = 30) -> list[dict]:
    """Divide texto en chunks semánticos usando separadores === como límites naturales."""
    
    import re
    
    # Detectar secciones por separadores ===
    patron_seccion = re.compile(r'(={3,}[^=\n]+={3,})', re.MULTILINE)
    partes = patron_seccion.split(texto)
    
    chunks = []
    titulo_actual = "general"
    contenido_acumulado = ""
    
    for parte in partes:
        parte = parte.strip()
        if not parte:
            continue
            
        # Si es un título de sección
        if patron_seccion.match(parte):
            # Guardar contenido anterior si existe
            if contenido_acumulado.strip():
                chunks.extend(_chunk_contenido(contenido_acumulado, titulo_actual, max_palabras, overlap))
            titulo_actual = parte.replace('=', '').strip()
            contenido_acumulado = ""
        else:
            contenido_acumulado += "\n" + parte
    
    # Guardar último bloque
    if contenido_acumulado.strip():
        chunks.extend(_chunk_contenido(contenido_acumulado, titulo_actual, max_palabras, overlap))
    
    return chunks


def _chunk_contenido(texto: str, titulo: str, max_palabras: int, overlap: int) -> list[dict]:
    """Divide un bloque de contenido en chunks si es demasiado largo."""
    
    palabras = texto.split()
    
    # Si cabe en un solo chunk, devuelve uno
    if len(palabras) <= max_palabras:
        return [{
            "texto": f"{titulo}\n{texto}".strip(),
            "tipo": detectar_tipo(texto),
            "metadata": {
                **extraer_metadata(texto),
                "titulo_seccion": titulo
            }
        }]
    
    # Si es muy largo, dividir con overlap
    chunks = []
    inicio = 0
    while inicio < len(palabras):
        fin = min(inicio + max_palabras, len(palabras))
        trozo = " ".join(palabras[inicio:fin])
        chunks.append({
            "texto": f"{titulo}\n{trozo}".strip(),
            "tipo": detectar_tipo(trozo),
            "metadata": {
                **extraer_metadata(trozo),
                "titulo_seccion": titulo
            }
        })
        inicio += max_palabras - overlap
    
    return chunks

async def indexar_bloque(db: Session, bloque_id: str, contenido: str) -> dict:
    """Vectoriza e indexa un bloque en la base de datos."""
    
    print(f"Indexando bloque {bloque_id}, longitud contenido: {len(contenido)}")
    try:
        chunks = dividir_en_chunks(contenido)
        insertados = 0

        for chunk in chunks:
            embedding = await generar_embedding(chunk["texto"])
            
            db.execute(
                text("""INSERT INTO chunks (bloque_id, contenido, tipo, embedding, metadata)
                   VALUES (:bloque_id, :contenido, :tipo, :embedding, :metadata)"""),
                {
                    "bloque_id": bloque_id,
                    "contenido": chunk["texto"],
                    "tipo": chunk["tipo"],
                    "embedding": json.dumps(embedding),
                    "metadata": json.dumps(chunk["metadata"])
                }
            )
            insertados += 1

        db.commit()
        return {"ok": True, "chunks_insertados": insertados}

    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        return {"ok": False, "error": str(e)}

async def recuperar_chunks(db: Session, materia_id: str, submateria_id: str = None, limite: int = 10) -> list[str]:
    """Recupera chunks de forma aleatoria y proporcional entre todos los bloques."""
    try:
        # Filtrar por submateria si se proporciona
        if submateria_id:
            bloques = db.execute(
                text("""SELECT id FROM bloques 
                       WHERE materia_id = :materia_id 
                       AND submateria_id = :submateria_id
                       AND activo = true"""),
                {"materia_id": materia_id, "submateria_id": submateria_id}
            ).fetchall()
        else:
            bloques = db.execute(
                text("""SELECT id FROM bloques 
                       WHERE materia_id = :materia_id AND activo = true"""),
                {"materia_id": materia_id}
            ).fetchall()

        if not bloques:
            return []

        import random
        bloques_lista = [b[0] for b in bloques]
        
        num_bloques = min(random.randint(2, 4), len(bloques_lista))
        bloques_seleccionados = random.sample(bloques_lista, num_bloques)
        
        chunks_por_bloque = max(2, limite // num_bloques)
        todos_chunks = []

        for bloque_id in bloques_seleccionados:
            result = db.execute(
                text("""SELECT contenido FROM chunks
                       WHERE bloque_id = :bloque_id
                       ORDER BY RANDOM()
                       LIMIT :limite"""),
                {"bloque_id": str(bloque_id), "limite": chunks_por_bloque}
            ).fetchall()
            todos_chunks.extend([row[0] for row in result])

        random.shuffle(todos_chunks)
        
        print(f"Bloques seleccionados: {len(bloques_seleccionados)} de {len(bloques_lista)} disponibles")
        print(f"Chunks recuperados: {len(todos_chunks)}")
        
        return todos_chunks[:limite]

    except Exception as e:
        print(f"Error recuperando chunks: {e}")
        return []

async def recuperar_chunks_por_bloque(db: Session, bloque_id: str, limite: int = 10) -> list[str]:
    """Recupera chunks de un bloque específico."""
    try:
        result = db.execute(
            text("""SELECT contenido FROM chunks
               WHERE bloque_id = :bloque_id
               ORDER BY created_at ASC
               LIMIT :limite"""),
            {"bloque_id": bloque_id, "limite": limite}
        )
        return [row[0] for row in result.fetchall()]

    except Exception as e:
        print(f"Error recuperando chunks por bloque: {e}")
        return []