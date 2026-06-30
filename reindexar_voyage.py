"""
reindexar_voyage.py
Rellena la columna embedding_voyage de los chunks existentes usando Voyage,
sin borrar ni recrear los chunks. Procesa en lotes y muestra progreso.
Ejecutar en el servidor con el venv del backend:
  /var/www/policial-mvp/venv/bin/python reindexar_voyage.py
"""
import os
import json
import sys
import time
import psycopg2
from dotenv import load_dotenv

# Cargar .env del backend
load_dotenv("/var/www/policial-mvp/backend/.env")

import voyageai

VOYAGE_MODEL = os.getenv("VOYAGE_MODEL", "voyage-3-large")
DATABASE_URL = os.getenv("DATABASE_URL")
api_key = os.getenv("VOYAGE_API_KEY")

if not api_key:
    print("ERROR: falta VOYAGE_API_KEY en el .env")
    sys.exit(1)

client = voyageai.Client(api_key=api_key)
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

# Traer chunks que aún no tienen embedding_voyage
cur.execute("SELECT id, contenido FROM chunks WHERE embedding_voyage IS NULL ORDER BY id;")
filas = cur.fetchall()
total = len(filas)
print(f"Chunks por procesar: {total}")

if total == 0:
    print("Nada que hacer: todos los chunks ya tienen embedding_voyage.")
    sys.exit(0)

LOTE = 50
procesados = 0

for i in range(0, total, LOTE):
    sublote = filas[i:i + LOTE]
    textos = [f[1] for f in sublote]
    ids = [f[0] for f in sublote]

    # Vectorizar el lote con Voyage
    try:
        res = client.embed(textos, model=VOYAGE_MODEL, input_type="document")
        vectores = res.embeddings
    except Exception as e:
        print(f"Error en lote {i}: {e}")
        time.sleep(5)
        continue

    # Actualizar cada chunk
    for cid, vec in zip(ids, vectores):
        cur.execute(
            "UPDATE chunks SET embedding_voyage = %s::vector WHERE id = %s;",
            (json.dumps(vec), cid)
        )

    conn.commit()
    procesados += len(sublote)
    print(f"  {procesados}/{total} chunks vectorizados")

cur.close()
conn.close()
print("Listo. embedding_voyage rellenado.")
