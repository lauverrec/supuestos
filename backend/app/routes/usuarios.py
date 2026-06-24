from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..middleware.auth_middleware import get_current_user

router = APIRouter()

@router.get("/perfil")
async def perfil(db: Session = Depends(get_db), clerk_id: str = Depends(get_current_user)):
    usuario = db.execute(
        text("SELECT clerk_id, plan, suscripcion_activa FROM usuarios WHERE clerk_id = :clerk_id"),
        {"clerk_id": clerk_id}
    ).fetchone()

    if not usuario:
        return {"clerk_id": clerk_id, "plan": "free", "suscripcion_activa": False}

    return {
        "clerk_id": usuario[0],
        "plan": usuario[1],
        "suscripcion_activa": usuario[2]
    }

@router.get("/progreso")
async def progreso(db: Session = Depends(get_db), clerk_id: str = Depends(get_current_user)):
    
    # Stats generales
    stats = db.execute(
        text("""SELECT 
            COUNT(s.id) as total_supuestos,
            AVG(r.puntuacion) as puntuacion_media,
            COUNT(CASE WHEN s.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as esta_semana
        FROM supuestos_generados s
        LEFT JOIN respuestas r ON r.supuesto_id = s.id
        WHERE s.usuario_id = :clerk_id"""),
        {"clerk_id": clerk_id}
    ).fetchone()

    # Por materia
    por_materia = db.execute(
        text("""SELECT m.nombre, COUNT(s.id) as total, AVG(r.puntuacion) as media
               FROM supuestos_generados s
               JOIN materias m ON s.materia_id = m.id
               LEFT JOIN respuestas r ON r.supuesto_id = s.id
               WHERE s.usuario_id = :clerk_id
               GROUP BY m.nombre
               ORDER BY total DESC"""),
        {"clerk_id": clerk_id}
    ).fetchall()

    # Últimas puntuaciones para gráfico de evolución
    evolución = db.execute(
        text("""SELECT r.puntuacion, s.created_at
               FROM respuestas r
               JOIN supuestos_generados s ON s.id = r.supuesto_id
               WHERE s.usuario_id = :clerk_id
               ORDER BY s.created_at ASC
               LIMIT 20"""),
        {"clerk_id": clerk_id}
    ).fetchall()

    return {
        "total_supuestos": stats[0] or 0,
        "puntuacion_media": round(float(stats[1]), 1) if stats[1] else None,
        "esta_semana": stats[2] or 0,
        "por_materia": [
            {"materia": r[0], "total": r[1], "media": round(float(r[2]), 1) if r[2] else None}
            for r in por_materia
        ],
        "evolucion": [
            {"puntuacion": float(r[0]), "fecha": str(r[1])}
            for r in evolución if r[0]
        ]
    }