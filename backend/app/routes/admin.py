from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from ..database import get_db
from ..services import rag_service
import uuid
import json

router = APIRouter()

class CrearMateriaRequest(BaseModel):
    nombre: str
    descripcion: str = ""
    orden: int = 1

class CrearBloqueRequest(BaseModel):
    materia_id: str
    titulo: str
    numero_bloque: int
    normativa_principal: list[str] = []

class IndexarBloqueRequest(BaseModel):
    bloque_id: str
    contenido: str

@router.get("/test")
async def test():
    return {"status": "admin ok"}

@router.get("/materias")
async def listar_materias(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT id, nombre, descripcion, orden FROM materias ORDER BY orden")).fetchall()
    return [{"id": str(r[0]), "nombre": r[1], "descripcion": r[2], "orden": r[3]} for r in result]

@router.post("/materias")
async def crear_materia(request: CrearMateriaRequest, db: Session = Depends(get_db)):
    materia_id = str(uuid.uuid4())
    db.execute(
        text("INSERT INTO materias (id, nombre, descripcion, orden) VALUES (:id, :nombre, :descripcion, :orden)"),
        {"id": materia_id, "nombre": request.nombre, "descripcion": request.descripcion, "orden": request.orden}
    )
    db.commit()
    return {"id": materia_id, "nombre": request.nombre}

@router.get("/bloques")
async def listar_bloques(db: Session = Depends(get_db)):
    result = db.execute(
        text("""SELECT b.id, b.titulo, b.numero_bloque, b.activo, m.nombre as materia,
               (SELECT COUNT(*) FROM chunks c WHERE c.bloque_id = b.id) as chunks
               FROM bloques b
               JOIN materias m ON b.materia_id = m.id
               ORDER BY b.numero_bloque""")
    ).fetchall()
    return [
        {
            "id": str(r[0]),
            "titulo": r[1],
            "numero_bloque": r[2],
            "activo": r[3],
            "materia": r[4],
            "chunks": r[5]
        }
        for r in result
    ]

@router.post("/bloques")
async def crear_bloque(request: CrearBloqueRequest, db: Session = Depends(get_db)):
    bloque_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO bloques (id, materia_id, titulo, numero_bloque, normativa_principal)
               VALUES (:id, :materia_id, :titulo, :numero_bloque, :normativa_principal)"""),
        {
            "id": bloque_id,
            "materia_id": request.materia_id,
            "titulo": request.titulo,
            "numero_bloque": request.numero_bloque,
            "normativa_principal": request.normativa_principal
        }
    )
    db.commit()
    return {"id": bloque_id, "titulo": request.titulo}

@router.post("/bloques/indexar")
async def indexar_bloque(request: IndexarBloqueRequest, db: Session = Depends(get_db)):
    # Borrar chunks anteriores del bloque si los hay
    db.execute(text("DELETE FROM chunks WHERE bloque_id = :id"), {"id": request.bloque_id})
    db.commit()

    resultado = await rag_service.indexar_bloque(db, request.bloque_id, request.contenido)

    if not resultado["ok"]:
        raise HTTPException(status_code=500, detail=f"Error indexando: {resultado.get('error', 'desconocido')}")

    return {
        "ok": True,
        "bloque_id": request.bloque_id,
        "chunks_insertados": resultado["chunks_insertados"]
    }

@router.get("/stats")
async def estadisticas(db: Session = Depends(get_db)):
    stats = {}
    stats["total_usuarios"] = db.execute(text("SELECT COUNT(*) FROM usuarios")).fetchone()[0]
    stats["total_supuestos"] = db.execute(text("SELECT COUNT(*) FROM supuestos_generados")).fetchone()[0]
    stats["total_respuestas"] = db.execute(text("SELECT COUNT(*) FROM respuestas")).fetchone()[0]
    stats["total_bloques"] = db.execute(text("SELECT COUNT(*) FROM bloques")).fetchone()[0]
    stats["total_chunks"] = db.execute(text("SELECT COUNT(*) FROM chunks")).fetchone()[0]
    stats["puntuacion_media"] = db.execute(text("SELECT ROUND(AVG(puntuacion)::numeric, 2) FROM respuestas")).fetchone()[0]
    return stats

@router.delete("/bloques/{bloque_id}")
async def borrar_bloque(bloque_id: str, db: Session = Depends(get_db)):
    # Borrar chunks asociados primero
    db.execute(text("DELETE FROM chunks WHERE bloque_id = :id"), {"id": bloque_id})
    # Borrar el bloque
    db.execute(text("DELETE FROM bloques WHERE id = :id"), {"id": bloque_id})
    db.commit()
    return {"ok": True, "mensaje": "Bloque eliminado"}