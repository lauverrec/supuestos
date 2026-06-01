from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from ..database import get_db
from ..services import claude_service, rag_service
import uuid
import json

router = APIRouter()

class GenerarRequest(BaseModel):
    materia_id: str
    dificultad: int = 2
    formato: str = "desarrollo"

class ResponderRequest(BaseModel):
    supuesto_id: str
    respuesta_texto: str
    tiempo_respuesta: int = 0

@router.get("/test")
async def test():
    return {"status": "supuestos ok"}

@router.post("/generar")
async def generar_supuesto(request: GenerarRequest, db: Session = Depends(get_db)):
    
    # Recuperar chunks RAG de la materia
    chunks = await rag_service.recuperar_chunks(db, request.materia_id)
    print(f"Chunks recuperados: {len(chunks)}")
    if chunks:
        print(f"Primer chunk: {chunks[0][:200]}")
    
    # Si no hay chunks usar contexto base
    if not chunks:
        raise HTTPException(
            status_code=404, 
            detail="Esta materia no tiene contenido indexado todavía. Ve al panel de admin e indexa bloques para esta materia."
        )

    # Generar supuesto
    # Obtener nombre de la materia
    materia_info = db.execute(
        text("SELECT nombre FROM materias WHERE id = :id"),
        {"id": request.materia_id}
    ).fetchone()

    nombre_materia = materia_info[0] if materia_info else "Policía Local de Andalucía"

    resultado = await claude_service.generar_supuesto(
        chunks=chunks,
        materia=nombre_materia,
        dificultad=request.dificultad,
        formato=request.formato
    )

    if not resultado["ok"]:
        raise HTTPException(status_code=500, detail="Error generando supuesto")

    # Guardar en base de datos
    supuesto_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO supuestos_generados 
           (id, materia_id, enunciado, solucion_modelo, formato, dificultad, bloques_usados)
           VALUES (:id, :materia_id, :enunciado, :solucion_modelo, :formato, :dificultad, :bloques_usados)"""),
        {
            "id": supuesto_id,
            "materia_id": request.materia_id,
            "enunciado": resultado["datos"]["enunciado"],
            "solucion_modelo": json.dumps(resultado["datos"]["solucion_modelo"], ensure_ascii=False),
            "formato": request.formato,
            "dificultad": request.dificultad,
            "bloques_usados": "{}"
        }
    )
    db.commit()

    # Devolver solo el enunciado — nunca la solución modelo
    return {
        "supuesto_id": supuesto_id,
        "enunciado": resultado["datos"]["enunciado"],
        "formato": request.formato,
        "dificultad": request.dificultad
    }

@router.post("/responder")
async def responder_supuesto(request: ResponderRequest, db: Session = Depends(get_db)):
    
    # Recuperar supuesto y su solución modelo
    result = db.execute(
        text("SELECT solucion_modelo FROM supuestos_generados WHERE id = :id"),
        {"id": request.supuesto_id}
    ).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Supuesto no encontrado")

    # PostgreSQL devuelve JSONB directamente como dict
    solucion_modelo = result[0] if isinstance(result[0], dict) else json.loads(result[0])

    # Corregir respuesta
    correccion = await claude_service.corregir_respuesta(
        respuesta_usuario=request.respuesta_texto,
        solucion_modelo=solucion_modelo
    )

    if not correccion["ok"]:
        raise HTTPException(status_code=500, detail="Error corrigiendo respuesta")

    # Guardar respuesta
    db.execute(
        text("""INSERT INTO respuestas 
           (supuesto_id, respuesta_texto, puntuacion, feedback, tiempo_respuesta)
           VALUES (:supuesto_id, :respuesta_texto, :puntuacion, :feedback, :tiempo_respuesta)"""),
        {
            "supuesto_id": request.supuesto_id,
            "respuesta_texto": request.respuesta_texto,
            "puntuacion": correccion["datos"].get("puntuacion", 0),
            "feedback": json.dumps(correccion["datos"], ensure_ascii=False),
            "tiempo_respuesta": request.tiempo_respuesta
        }
    )
    db.commit()

    return {
        "puntuacion": correccion["datos"].get("puntuacion"),
        "feedback": correccion["datos"]
    }

@router.get("/historial")
async def historial(db: Session = Depends(get_db)):
    result = db.execute(
        text("""SELECT id, enunciado, formato, dificultad, created_at 
               FROM supuestos_generados 
               ORDER BY created_at DESC 
               LIMIT 20""")
    ).fetchall()
    
    return [
        {
            "id": str(row[0]),
            "enunciado": row[1][:100] + "...",
            "formato": row[2],
            "dificultad": row[3],
            "created_at": str(row[4])
        }
        for row in result
    ]
    
@router.get("/{supuesto_id}")
async def detalle_supuesto(supuesto_id: str, db: Session = Depends(get_db)):
    
    # Recuperar supuesto
    supuesto = db.execute(
        text("SELECT id, enunciado, formato, dificultad FROM supuestos_generados WHERE id = :id"),
        {"id": supuesto_id}
    ).fetchone()

    if not supuesto:
        raise HTTPException(status_code=404, detail="Supuesto no encontrado")

    # Recuperar última respuesta y su feedback
    respuesta = db.execute(
        text("""SELECT puntuacion, feedback 
               FROM respuestas 
               WHERE supuesto_id = :id 
               ORDER BY created_at DESC 
               LIMIT 1"""),
        {"id": supuesto_id}
    ).fetchone()

    return {
        "supuesto_id": str(supuesto[0]),
        "enunciado": supuesto[1],
        "formato": supuesto[2],
        "dificultad": supuesto[3],
        "puntuacion": float(respuesta[0]) if respuesta else None,
        "feedback": respuesta[1] if respuesta else None
    }