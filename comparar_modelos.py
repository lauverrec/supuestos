"""
comparar_modelos.py
-------------------
Compara DOS modelos de Voyage (voyage-2 y voyage-3-large) para el mismo enunciado,
mostrando los chunks que recupera cada uno lado a lado. Así decides cuál es más
acertado para tu material jurídico, con evidencia en vez de sensación.

Requisitos:
  pip install voyageai numpy
  set VOYAGE_API_KEY=tu_key

Uso:
  python comparar_modelos.py
"""

import os
import sys
import numpy as np
import voyageai

ARCHIVO_CHUNKS = "chunks_export.txt"
SEPARADOR = "~~~CHUNK~~~"
MODELOS = ["voyage-2", "voyage-3-large"]   # los dos a comparar
TOP_N = 10


def cargar_chunks(ruta):
    if not os.path.exists(ruta):
        print(f"ERROR: no encuentro '{ruta}'.")
        sys.exit(1)
    with open(ruta, "r", encoding="utf-8", errors="replace") as f:
        texto = f.read()
    chunks = [c.strip() for c in texto.split(SEPARADOR) if c.strip()]
    chunks = [c for c in chunks if "could not change directory" not in c]
    return chunks


def coseno(a, b):
    a, b = np.array(a), np.array(b)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(np.dot(a, b) / (na * nb)) if na and nb else 0.0


def main():
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        print("ERROR: falta VOYAGE_API_KEY. En CMD: set VOYAGE_API_KEY=tu_key")
        sys.exit(1)

    cliente = voyageai.Client(api_key=api_key)
    chunks = cargar_chunks(ARCHIVO_CHUNKS)
    print(f"{len(chunks)} chunks cargados.\n")

    # Vectorizar los chunks con cada modelo (una vez)
    vectores = {}
    for modelo in MODELOS:
        print(f"Vectorizando con {modelo}...")
        vecs = []
        LOTE = 100
        for i in range(0, len(chunks), LOTE):
            sub = chunks[i:i + LOTE]
            res = cliente.embed(sub, model=modelo, input_type="document")
            vecs.extend(res.embeddings)
            print(f"  {modelo}: {min(i + LOTE, len(chunks))}/{len(chunks)}")
        vectores[modelo] = vecs

    print("\nListo. Pega enunciados para comparar.\n")

    while True:
        print("=" * 70)
        print("Pega el ENUNCIADO (o 'salir'). Línea vacía + Enter para terminar:")
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

        for modelo in MODELOS:
            res_q = cliente.embed([enunciado], model=modelo, input_type="query")
            vq = res_q.embeddings[0]
            sims = sorted(
                [(coseno(vq, v), i) for i, v in enumerate(vectores[modelo])],
                reverse=True
            )
            print("\n" + "=" * 70)
            print(f"MODELO: {modelo}")
            print("=" * 70)
            for rank, (sim, idx) in enumerate(sims[:TOP_N], 1):
                preview = chunks[idx][:280].replace("\n", " ")
                print(f"\n[{rank}] sim {sim:.4f}")
                print(f"    {preview}{'...' if len(chunks[idx]) > 280 else ''}")
        print("\n")


if __name__ == "__main__":
    main()
