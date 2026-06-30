"""
comparar_voyage.py
-------------------
Compara la recuperación de chunks entre DOS sistemas para el mismo enunciado:
  A) El sistema ACTUAL en producción (embedding de hashes)
  B) Voyage AI (embedding real)

Para cada enunciado muestra, lado a lado, los chunks que cada sistema
consideraría más relevantes. Así ves por qué el sistema actual recupera mal.

No toca producción. Todo ocurre en tu equipo.

Requisitos:
  pip install voyageai numpy
  set VOYAGE_API_KEY=tu_key   (en la misma ventana de CMD antes de ejecutar)

Uso:
  python comparar_voyage.py
"""

import os
import sys
import numpy as np
import voyageai

# ---------- Configuración ----------
ARCHIVO_CHUNKS = "chunks_export.txt"
SEPARADOR = "~~~CHUNK~~~"
MODELO_VOYAGE = "voyage-2"   # cámbialo por "voyage-law-2" o "voyage-2" para comparar modelos
TOP_N = 10
# -----------------------------------


# ====== Réplica EXACTA del embedding de hashes en producción ======
def embedding_hashes(texto):
    """Replica la función generar_embedding del servidor (hashes)."""
    palabras = texto.lower().split()
    vector = [0.0] * 1536
    for i, palabra in enumerate(palabras[:1536]):
        # hash estable: usamos un hash propio reproducible en vez de hash() de Python
        h = 0
        for ch in palabra:
            h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        vector[i % 1536] += (h % 1000) / 1000.0
    magnitud = sum(x ** 2 for x in vector) ** 0.5
    if magnitud > 0:
        vector = [x / magnitud for x in vector]
    return vector
# ==================================================================


def cargar_chunks(ruta):
    if not os.path.exists(ruta):
        print(f"ERROR: no encuentro '{ruta}'. Ejecútalo en la carpeta donde está el archivo.")
        sys.exit(1)
    with open(ruta, "r", encoding="utf-8", errors="replace") as f:
        texto = f.read()
    chunks = [c.strip() for c in texto.split(SEPARADOR) if c.strip()]
    chunks = [c for c in chunks if "could not change directory" not in c]
    return chunks


def coseno(a, b):
    a = np.array(a)
    b = np.array(b)
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def mostrar_top(titulo, similitudes, chunks):
    print("\n" + "=" * 70)
    print(titulo)
    print("=" * 70)
    for rank, (sim, idx) in enumerate(similitudes[:TOP_N], 1):
        preview = chunks[idx][:300].replace("\n", " ")
        print(f"\n[{rank}] similitud: {sim:.4f}")
        print(f"    {preview}{'...' if len(chunks[idx]) > 300 else ''}")


def main():
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        print("ERROR: falta la API key. En CMD ejecuta antes:")
        print('   set VOYAGE_API_KEY=tu_key_aqui')
        sys.exit(1)

    cliente = voyageai.Client(api_key=api_key)

    print(f"Cargando chunks de '{ARCHIVO_CHUNKS}'...")
    chunks = cargar_chunks(ARCHIVO_CHUNKS)
    print(f"  -> {len(chunks)} chunks cargados.")
    if not chunks:
        sys.exit(1)

    # Vectorizar con Voyage (una vez)
    print(f"Vectorizando chunks con Voyage ('{MODELO_VOYAGE}')...")
    vectores_voyage = []
    LOTE = 100
    for i in range(0, len(chunks), LOTE):
        sub = chunks[i:i + LOTE]
        res = cliente.embed(sub, model=MODELO_VOYAGE, input_type="document")
        vectores_voyage.extend(res.embeddings)
        print(f"  Voyage: {min(i + LOTE, len(chunks))}/{len(chunks)}")

    # Vectorizar con hashes (una vez, instantáneo)
    print("Vectorizando chunks con el sistema actual (hashes)...")
    vectores_hashes = [embedding_hashes(c) for c in chunks]

    print("\nListo. Pega enunciados para comparar.\n")

    while True:
        print("=" * 70)
        print("Pega el ENUNCIADO (o 'salir'). Deja una línea vacía y Enter para terminar:")
        print("-" * 70)
        lineas = []
        while True:
            try:
                linea = input()
            except EOFError:
                linea = ""
            if linea.strip().lower() == "salir":
                print("Hasta luego.")
                return
            if linea == "" and lineas:
                break
            if linea != "":
                lineas.append(linea)
        enunciado = "\n".join(lineas).strip()
        if not enunciado:
            continue

        # --- Voyage ---
        res_q = cliente.embed([enunciado], model=MODELO_VOYAGE, input_type="query")
        vq_voyage = res_q.embeddings[0]
        sims_voyage = sorted(
            [(coseno(vq_voyage, v), i) for i, v in enumerate(vectores_voyage)],
            reverse=True
        )

        # --- Hashes (sistema actual) ---
        vq_hashes = embedding_hashes(enunciado)
        sims_hashes = sorted(
            [(coseno(vq_hashes, v), i) for i, v in enumerate(vectores_hashes)],
            reverse=True
        )

        mostrar_top(f"SISTEMA ACTUAL EN PRODUCCIÓN (hashes)", sims_hashes, chunks)
        mostrar_top(f"VOYAGE ({MODELO_VOYAGE})", sims_voyage, chunks)
        print("\n")


if __name__ == "__main__":
    main()
