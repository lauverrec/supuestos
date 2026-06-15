import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from ..database import get_db
from ..middleware.auth_middleware import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

PRICES = {
    "mensual": "price_1TieWn3x29cnznIihX9WGzUh",
    "anual": "price_1TieX93x29cnznIij0qdyIn2"
}

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://184.174.39.148")

router = APIRouter()

class CheckoutRequest(BaseModel):
    plan: str  # "mensual" o "anual"

@router.post("/crear-sesion")
async def crear_sesion_pago(request: CheckoutRequest, db: Session = Depends(get_db), clerk_id: str = Depends(get_current_user)):
    
    if request.plan not in PRICES:
        raise HTTPException(status_code=400, detail="Plan no válido")

    # Obtener o crear cliente en Stripe
    usuario = db.execute(
        text("SELECT stripe_customer_id FROM usuarios WHERE clerk_id = :clerk_id"),
        {"clerk_id": clerk_id}
    ).fetchone()

    customer_id = None
    if usuario and usuario[0]:
        customer_id = usuario[0]

    session_params = {
        "mode": "subscription",
        "payment_method_types": ["card"],
        "line_items": [{"price": PRICES[request.plan], "quantity": 1}],
        "success_url": f"{FRONTEND_URL}/dashboard?pago=ok",
        "cancel_url": f"{FRONTEND_URL}/precios",
        "metadata": {"clerk_id": clerk_id},
        "subscription_data": {"metadata": {"clerk_id": clerk_id}},
    }

    if customer_id:
        session_params["customer"] = customer_id
    
    session = stripe.checkout.Session.create(**session_params)

    return {"url": session.url}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook inválido")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        customer_id = session.customer
        subscription_id = session.subscription
        
        # Acceder a metadata directamente
        clerk_id = None
        try:
            clerk_id = session.metadata["clerk_id"]
        except (KeyError, TypeError, AttributeError):
            pass

        if clerk_id:
            db.execute(
                text("""INSERT INTO usuarios (id, clerk_id, plan, suscripcion_activa, stripe_customer_id, stripe_subscription_id)
                        VALUES (gen_random_uuid(), :clerk_id, 'pro', true, :customer_id, :subscription_id)
                        ON CONFLICT (clerk_id) DO UPDATE 
                        SET plan = 'pro', suscripcion_activa = true,
                            stripe_customer_id = :customer_id,
                            stripe_subscription_id = :subscription_id"""),
                {"clerk_id": clerk_id, "customer_id": customer_id, "subscription_id": subscription_id}
            )
            db.commit()

    elif event["type"] in ["customer.subscription.deleted", "customer.subscription.paused"]:
        subscription = event["data"]["object"]
        customer_id = subscription.customer

        db.execute(
            text("""UPDATE usuarios 
                    SET plan = 'free', suscripcion_activa = false
                    WHERE stripe_customer_id = :customer_id"""),
            {"customer_id": customer_id}
        )
        db.commit()

    return {"ok": True}