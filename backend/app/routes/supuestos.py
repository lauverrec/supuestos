from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from ..database import get_db
from ..services import claude_service, rag_service
import uuid
import json
from ..middleware.auth_middleware import get_current_user

router = APIRouter()

class GenerarRequest(BaseModel):
    materia_id: str
    submateria_id: str = None
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
async def generar_supuesto(request: GenerarRequest, db: Session = Depends(get_db), clerk_id: str = Depends(get_current_user)):
    
    chunks = await rag_service.recuperar_chunks(db, request.materia_id, request.submateria_id)
    print(f"Chunks recuperados: {len(chunks)}")
    if chunks:
        print(f"Primer chunk: {chunks[0][:200]}")
    
    if not chunks:
        raise HTTPException(
            status_code=404, 
            detail="Esta materia no tiene contenido indexado todavía. Ve al panel de admin e indexa bloques para esta materia."
        )
    
    # Crear usuario si no existe
    db.execute(
        text("""INSERT INTO usuarios (id, clerk_id, plan, suscripcion_activa)
                VALUES (gen_random_uuid(), :clerk_id, 'free', false)
                ON CONFLICT (clerk_id) DO NOTHING"""),
        {"clerk_id": clerk_id}
    )

    db.commit()

    # Verificar límite freemium
    supuestos_count = db.execute(
        text("SELECT COUNT(*) FROM supuestos_generados WHERE usuario_id = :clerk_id"),
        {"clerk_id": clerk_id}
    ).fetchone()[0]

    usuario_plan = db.execute(
        text("SELECT plan FROM usuarios WHERE clerk_id = :clerk_id"),
        {"clerk_id": clerk_id}
    ).fetchone()

    plan = usuario_plan[0] if usuario_plan else "free"

    if plan == "free" and supuestos_count >= 3:
        raise HTTPException(
            status_code=403,
            detail="Has alcanzado el límite de 3 supuestos gratuitos. Actualiza tu plan para continuar."
        )
    
    # Verificar límite freemium
    supuestos_count = db.execute(
        text("SELECT COUNT(*) FROM supuestos_generados WHERE usuario_id = :clerk_id"),
        {"clerk_id": clerk_id}
    ).fetchone()[0]

    # Obtener plan del usuario (por ahora todos son free salvo que tengan suscripción activa)
    usuario_plan = db.execute(
        text("SELECT plan FROM usuarios WHERE clerk_id = :clerk_id"),
        {"clerk_id": clerk_id}
    ).fetchone()

    plan = usuario_plan[0] if usuario_plan else "free"

    if plan == "free" and supuestos_count >= 3:
        raise HTTPException(
            status_code=403,
            detail="Has alcanzado el límite de 3 supuestos gratuitos. Actualiza tu plan para continuar."
        )

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

    # Generar preguntas test si procede
    preguntas_test = []
    if request.formato == "test":
        print(f"Generando preguntas test para dificultad {request.dificultad}")
        test_result = await claude_service.generar_preguntas_test(
            supuesto_enunciado=resultado["datos"]["enunciado"],
            solucion_modelo=resultado["datos"]["solucion_modelo"],
            materia=nombre_materia,
            dificultad=request.dificultad
        )
        print(f"Resultado test: ok={test_result['ok']}, error={test_result.get('error', '')}, preguntas={len(test_result.get('datos', {}).get('preguntas_test', []))}")
        if test_result["ok"]:
            preguntas_test = test_result["datos"].get("preguntas_test", [])

    # Guardar en base de datos con las preguntas ya generadas
    supuesto_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO supuestos_generados 
        (id, materia_id, enunciado, solucion_modelo, formato, dificultad, bloques_usados, opciones_test, usuario_id)
        VALUES (:id, :materia_id, :enunciado, :solucion_modelo, :formato, :dificultad, :bloques_usados, :opciones_test, :usuario_id)"""),
        {
            "id": supuesto_id,
            "materia_id": request.materia_id,
            "enunciado": resultado["datos"]["enunciado"],
            "solucion_modelo": json.dumps(resultado["datos"]["solucion_modelo"], ensure_ascii=False),
            "formato": request.formato,
            "dificultad": request.dificultad,
            "bloques_usados": json.dumps(chunks, ensure_ascii=False),
            "opciones_test": json.dumps(preguntas_test, ensure_ascii=False),
            "usuario_id": clerk_id
        }
    )
    db.commit()

    return {
        "supuesto_id": supuesto_id,
        "enunciado": resultado["datos"]["enunciado"],
        "formato": request.formato,
        "dificultad": request.dificultad,
        "preguntas_test": preguntas_test
    }

@router.post("/responder")
async def responder_supuesto(request: ResponderRequest, db: Session = Depends(get_db), clerk_id: str = Depends(get_current_user)):
    
    supuesto_info = db.execute(
        text("SELECT solucion_modelo, dificultad, formato, opciones_test, bloques_usados FROM supuestos_generados WHERE id = :id"),
        {"id": request.supuesto_id}
    ).fetchone()

    if not supuesto_info:
        raise HTTPException(status_code=404, detail="Supuesto no encontrado")

    solucion_modelo = supuesto_info[0] if isinstance(supuesto_info[0], dict) else json.loads(supuesto_info[0])
    dificultad = supuesto_info[1] or 2
    formato = supuesto_info[2]
    preguntas_test = supuesto_info[3] if isinstance(supuesto_info[3], list) else json.loads(supuesto_info[3] or "[]")

    chunks_originales = supuesto_info[4] if isinstance(supuesto_info[4], list) else json.loads(supuesto_info[4] or "[]")

    materia_result = db.execute(
        text("""SELECT m.nombre FROM materias m 
                JOIN supuestos_generados s ON s.materia_id = m.id 
                WHERE s.id = :id"""),
        {"id": request.supuesto_id}
    ).fetchone()

    nombre_materia = materia_result[0] if materia_result else "Policía Local de Andalucía"

    # Corrección según formato
    if formato == "test" and preguntas_test:
        try:
            respuestas_usuario = json.loads(request.respuesta_texto)
        except:
            respuestas_usuario = {}
        
        correccion = await claude_service.corregir_respuesta_test(
            respuestas_usuario=respuestas_usuario,
            preguntas_test=preguntas_test,
            materia=nombre_materia
        )
    else:
        correccion = await claude_service.corregir_respuesta(
            respuesta_usuario=request.respuesta_texto,
            solucion_modelo=solucion_modelo,
            materia=nombre_materia,
            dificultad=dificultad,
            chunks_originales=chunks_originales
        )

    if not correccion["ok"]:
        raise HTTPException(status_code=500, detail="Error corrigiendo respuesta")

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
async def historial(db: Session = Depends(get_db), clerk_id: str = Depends(get_current_user)):
    result = db.execute(
        text("""SELECT id, enunciado, formato, dificultad, created_at 
               FROM supuestos_generados 
               WHERE usuario_id = :clerk_id
               ORDER BY created_at DESC 
               LIMIT 20"""),
        {"clerk_id": clerk_id}
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
    
    supuesto = db.execute(
        text("SELECT id, enunciado, formato, dificultad, solucion_modelo FROM supuestos_generados WHERE id = :id"),
        {"id": supuesto_id}
    ).fetchone()

    if not supuesto:
        raise HTTPException(status_code=404, detail="Supuesto no encontrado")

    respuesta = db.execute(
        text("""SELECT puntuacion, feedback 
               FROM respuestas 
               WHERE supuesto_id = :id 
               ORDER BY created_at DESC 
               LIMIT 1"""),
        {"id": supuesto_id}
    ).fetchone()

    solucion_modelo = supuesto[4] if isinstance(supuesto[4], dict) else json.loads(supuesto[4] or '{}')

    return {
        "supuesto_id": str(supuesto[0]),
        "enunciado": supuesto[1],
        "formato": supuesto[2],
        "dificultad": supuesto[3],
        "solucion_modelo": solucion_modelo,
        "puntuacion": float(respuesta[0]) if respuesta else None,
        "feedback": respuesta[1] if respuesta else None
    }

@router.post("/generar/aleatorio")
async def generar_supuesto_aleatorio(request: GenerarRequest, db: Session = Depends(get_db)):
    
    # Obtener materias que tienen chunks indexados
    materias_con_chunks = db.execute(
        text("""SELECT DISTINCT b.materia_id FROM bloques b
                JOIN chunks c ON c.bloque_id = b.id
                WHERE b.activo = true""")
    ).fetchall()

    if not materias_con_chunks:
        raise HTTPException(status_code=404, detail="No hay contenido indexado en ninguna materia.")

    import random
    materia_id = random.choice(materias_con_chunks)[0]
    request.materia_id = str(materia_id)
    
    return await generar_supuesto(request, db)