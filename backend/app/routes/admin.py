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
        text("""SELECT b.id, b.titulo, b.numero_bloque, b.activo, 
                       m.nombre as materia, s.nombre as submateria,
                       COUNT(c.id) as chunks
               FROM bloques b
               JOIN materias m ON b.materia_id = m.id
               LEFT JOIN submaterias s ON b.submateria_id = s.id
               LEFT JOIN chunks c ON c.bloque_id = b.id
               GROUP BY b.id, b.titulo, b.numero_bloque, b.activo, m.nombre, s.nombre
               ORDER BY m.nombre, s.nombre, b.numero_bloque""")
    ).fetchall()
    return [
        {
            "id": str(r[0]),
            "titulo": r[1],
            "numero_bloque": r[2],
            "activo": r[3],
            "materia": r[4],
            "submateria": r[5],
            "chunks": r[6]
        }
        for r in result
    ]

@router.post("/bloques")
async def crear_bloque(data: dict, db: Session = Depends(get_db)):
    result = db.execute(
        text("""INSERT INTO bloques (id, materia_id, submateria_id, titulo, numero_bloque, normativa_principal)
                VALUES (gen_random_uuid(), :materia_id, :submateria_id, :titulo, :numero_bloque, :normativa_principal)
                RETURNING id, titulo"""),
        {
            "materia_id": data["materia_id"],
            "submateria_id": data.get("submateria_id"),
            "titulo": data["titulo"],
            "numero_bloque": data.get("numero_bloque", 1),
            "normativa_principal": data.get("normativa_principal", [])
        }
    ).fetchone()
    db.commit()
    return {"id": str(result[0]), "titulo": result[1]}

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

# GET submaterias por materia
@router.get("/submaterias/{materia_id}")
async def listar_submaterias(materia_id: str, db: Session = Depends(get_db)):
    result = db.execute(
        text("""SELECT s.id, s.nombre, s.descripcion, s.orden, m.nombre as materia
               FROM submaterias s
               JOIN materias m ON s.materia_id = m.id
               WHERE s.materia_id = :materia_id 
               ORDER BY s.orden"""),
        {"materia_id": materia_id}
    ).fetchall()
    return [{"id": str(r[0]), "nombre": r[1], "descripcion": r[2], "orden": r[3], "materia": r[4]} for r in result]

@router.get("/submaterias")
async def listar_todas_submaterias(db: Session = Depends(get_db)):
    result = db.execute(
        text("""SELECT s.id, s.nombre, s.descripcion, s.orden, m.nombre as materia
               FROM submaterias s
               JOIN materias m ON s.materia_id = m.id
               ORDER BY m.nombre, s.orden""")
    ).fetchall()
    return [{"id": str(r[0]), "nombre": r[1], "descripcion": r[2], "orden": r[3], "materia": r[4]} for r in result]

# POST crear submateria
@router.post("/submaterias")
async def crear_submateria(data: dict, db: Session = Depends(get_db)):
    result = db.execute(
        text("""INSERT INTO submaterias (id, materia_id, nombre, descripcion, orden)
                VALUES (gen_random_uuid(), :materia_id, :nombre, :descripcion, :orden)
                RETURNING id, nombre"""),
        {
            "materia_id": data["materia_id"],
            "nombre": data["nombre"],
            "descripcion": data.get("descripcion", ""),
            "orden": data.get("orden", 1)
        }
    ).fetchone()
    db.commit()
    return {"id": str(result[0]), "nombre": result[1]}

# DELETE submateria
@router.delete("/submaterias/{submateria_id}")
async def eliminar_submateria(submateria_id: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM submaterias WHERE id = :id"), {"id": submateria_id})
    db.commit()
    return {"ok": True}

@router.delete("/materias/{materia_id}")
async def eliminar_materia(materia_id: str, db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM materias WHERE id = :id"), {"id": materia_id})
        db.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail="No se puede eliminar — tiene bloques asociados")
    
@router.get("/estructura-materias")
async def estructura_materias(db: Session = Depends(get_db)):
    materias = db.execute(
        text("SELECT id, nombre FROM materias ORDER BY orden")
    ).fetchall()
    
    resultado = []
    for m in materias:
        submaterias = db.execute(
            text("""SELECT s.id, s.nombre 
                   FROM submaterias s
                   WHERE s.materia_id = :materia_id 
                   ORDER BY s.orden"""),
            {"materia_id": m[0]}
        ).fetchall()
        
        resultado.append({
            "id": str(m[0]),
            "nombre": m[1],
            "submaterias": [{"id": str(s[0]), "nombre": s[1]} for s in submaterias]
        })
    
    return resultado