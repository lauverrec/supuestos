from sqlalchemy import text
import os
import re
import json
from sqlalchemy.orm import Session
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ---- Configuración de embeddings ----
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "hashes").lower()
VOYAGE_MODEL = os.getenv("VOYAGE_MODEL", "voyage-3-large")
# Columna de la BD según proveedor: hashes -> embedding (1536); voyage -> embedding_voyage (1024)
EMBEDDING_COLUMN = "embedding_voyage" if EMBEDDING_PROVIDER == "voyage" else "embedding"

# Cliente Voyage (solo si se usa)
_voyage_client = None
if EMBEDDING_PROVIDER == "voyage":
    try:
        import voyageai
        _voyage_client = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))
        print(f"[rag] Voyage activado, modelo {VOYAGE_MODEL}, columna {EMBEDDING_COLUMN}")
    except Exception as e:
        print(f"[rag] ERROR inicializando Voyage, se usarán hashes: {e}")
        EMBEDDING_PROVIDER = "hashes"
        EMBEDDING_COLUMN = "embedding"


def _embedding_hashes(texto: str) -> list[float]:
    """Embedding antiguo basado en hashes (1536 dim). Fallback / modo legacy."""
    palabras = texto.lower().split()
    vector = [0.0] * 1536
    for i, palabra in enumerate(palabras[:1536]):
        vector[i % 1536] += hash(palabra) % 1000 / 1000.0
    magnitud = sum(x ** 2 for x in vector) ** 0.5
    if magnitud > 0:
        vector = [x / magnitud for x in vector]
    return vector


def _embedding_voyage(texto: str, input_type: str = "document") -> list[float]:
    """Embedding real con Voyage (1024 dim para voyage-3-large)."""
    res = _voyage_client.embed([texto], model=VOYAGE_MODEL, input_type=input_type)
    return res.embeddings[0]


async def generar_embedding(texto: str, input_type: str = "document") -> list[float]:
    """Genera embedding según el proveedor configurado (EMBEDDING_PROVIDER)."""
    if EMBEDDING_PROVIDER == "voyage" and _voyage_client is not None:
        try:
            return _embedding_voyage(texto, input_type=input_type)
        except Exception as e:
            print(f"[rag] Error Voyage embedding, fallback a hashes: {e}")
            return _embedding_hashes(texto)
    return _embedding_hashes(texto)


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
    patron_seccion = re.compile(r'(={3,}[^=\n]+={3,})', re.MULTILINE)
    partes = patron_seccion.split(texto)

    chunks = []
    titulo_actual = "general"
    contenido_acumulado = ""

    for parte in partes:
        parte = parte.strip()
        if not parte:
            continue
        if patron_seccion.match(parte):
            if contenido_acumulado.strip():
                chunks.extend(_chunk_contenido(contenido_acumulado, titulo_actual, max_palabras, overlap))
            titulo_actual = parte.replace('=', '').strip()
            contenido_acumulado = ""
        else:
            contenido_acumulado += "\n" + parte

    if contenido_acumulado.strip():
        chunks.extend(_chunk_contenido(contenido_acumulado, titulo_actual, max_palabras, overlap))

    return chunks


def _chunk_contenido(texto: str, titulo: str, max_palabras: int, overlap: int) -> list[dict]:
    """Divide un bloque de contenido en chunks si es demasiado largo."""
    palabras = texto.split()

    if len(palabras) <= max_palabras:
        return [{
            "texto": f"{titulo}\n{texto}".strip(),
            "tipo": detectar_tipo(texto),
            "metadata": {**extraer_metadata(texto), "titulo_seccion": titulo}
        }]

    chunks = []
    inicio = 0
    while inicio < len(palabras):
        fin = min(inicio + max_palabras, len(palabras))
        trozo = " ".join(palabras[inicio:fin])
        chunks.append({
            "texto": f"{titulo}\n{trozo}".strip(),
            "tipo": detectar_tipo(trozo),
            "metadata": {**extraer_metadata(trozo), "titulo_seccion": titulo}
        })
        inicio += max_palabras - overlap

    return chunks


async def indexar_bloque(db: Session, bloque_id: str, contenido: str) -> dict:
    """Vectoriza e indexa un bloque en la base de datos (columna según proveedor)."""
    print(f"Indexando bloque {bloque_id}, longitud contenido: {len(contenido)}, proveedor: {EMBEDDING_PROVIDER}")
    try:
        chunks = dividir_en_chunks(contenido)
        insertados = 0

        for chunk in chunks:
            embedding = await generar_embedding(chunk["texto"], input_type="document")

            # Insertar rellenando la columna correcta según proveedor
            db.execute(
                text(f"""INSERT INTO chunks (bloque_id, contenido, tipo, {EMBEDDING_COLUMN}, metadata)
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


async def recuperar_chunks(db: Session, materia_id: str, submateria_id: str = None,
                           limite: int = 10, enunciado: str = None) -> list[str]:
    """
    Recupera chunks relevantes.
    Si hay enunciado y proveedor Voyage: búsqueda por similitud real (vector).
    Si no: método aleatorio antiguo (fallback).
    """
    try:
        # Bloques candidatos (filtro por materia/submateria)
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

        bloques_lista = [str(b[0]) for b in bloques]

        # --- Búsqueda por similitud real (Voyage) ---
        if EMBEDDING_PROVIDER == "voyage" and enunciado and _voyage_client is not None:
            try:
                vector_query = await generar_embedding(enunciado, input_type="query")
                vector_str = json.dumps(vector_query)

                result = db.execute(
                    text(f"""SELECT contenido
                           FROM chunks
                           WHERE bloque_id = ANY(CAST(:bloques AS uuid[]))
                             AND {EMBEDDING_COLUMN} IS NOT NULL
                           ORDER BY {EMBEDDING_COLUMN} <=> CAST(:vq AS vector)
                           LIMIT :limite"""),
                    {"bloques": bloques_lista, "vq": vector_str, "limite": limite}
                ).fetchall()

                chunks = [row[0] for row in result]
                print(f"[rag] Búsqueda Voyage por similitud: {len(chunks)} chunks de {len(bloques_lista)} bloques")
                if chunks:
                    return chunks
                # si no hubo resultados (chunks sin vector Voyage aún), cae al método aleatorio
                print("[rag] Sin resultados Voyage, fallback aleatorio")
            except Exception as e:
                print(f"[rag] Error búsqueda Voyage, fallback aleatorio: {e}")

        # --- Método aleatorio (fallback / modo hashes) ---
        import random
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
        print(f"Chunks recuperados (aleatorio): {len(todos_chunks)}")
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