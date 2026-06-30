"""
reindexar_voyage2.py
Regenera la columna embedding_voyage con el modelo indicado en el .env
(VOYAGE_MODEL, ahora voyage-2). Primero pone a NULL los vectores viejos
(de voyage-3-large, incompatibles) y luego los rellena de nuevo.

Ejecutar en el servidor con el venv del backend:
  /var/www/policial-mvp/venv/bin/python /tmp/reindexar_voyage2.py
"""
import os
import json
import sys
import time
import psycopg2
from dotenv import load_dotenv

load_dotenv("/var/www/policial-mvp/backend/.env")
import voyageai

VOYAGE_MODEL = os.getenv("VOYAGE_MODEL", "voyage-2")
DATABASE_URL = os.getenv("DATABASE_URL")
api_key = os.getenv("VOYAGE_API_KEY")

if not api_key:
    print("ERROR: falta VOYAGE_API_KEY en el .env")
    sys.exit(1)

print(f"Modelo de re-indexado: {VOYAGE_MODEL}")
client = voyageai.Client(api_key=api_key)
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

# 1) Vaciar vectores viejos (incompatibles con voyage-2)
print("Vaciando embedding_voyage anterior...")
cur.execute("UPDATE chunks SET embedding_voyage = NULL;")
conn.commit()

# 2) Traer todos los chunks
cur.execute("SELECT id, contenido FROM chunks ORDER BY id;")
filas = cur.fetchall()
total = len(filas)
print(f"Chunks a vectorizar: {total}")

LOTE = 50
procesados = 0
for i in range(0, total, LOTE):
    sublote = filas[i:i + LOTE]
    textos = [f[1] for f in sublote]
    ids = [f[0] for f in sublote]
    try:
        res = client.embed(textos, model=VOYAGE_MODEL, input_type="document")
        vectores = res.embeddings
    except Exception as e:
        print(f"Error en lote {i}: {e}")
        time.sleep(5)
        continue
    for cid, vec in zip(ids, vectores):
        cur.execute(
            "UPDATE chunks SET embedding_voyage = %s::vector WHERE id = %s;",
            (json.dumps(vec), cid)
        )
    conn.commit()
    procesados += len(sublote)
    print(f"  {procesados}/{total}")

cur.close()
conn.close()
print(f"Listo. embedding_voyage regenerado con {VOYAGE_MODEL}.")
