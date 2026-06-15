from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .database import test_connection
from .routes import supuestos, correccion, admin, auth, stripe_routes

load_dotenv()

app = FastAPI(
    title="Policial MVP API",
    description="API para simulador de supuestos prácticos Policía Local Andalucía",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(supuestos.router, prefix="/api/supuestos", tags=["supuestos"])
app.include_router(correccion.router, prefix="/api/correccion", tags=["correccion"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(stripe_routes.router, prefix="/api/stripe")

@app.on_event("startup")
async def startup():
    test_connection()

@app.get("/")
async def root():
    return {"status": "ok", "mensaje": "Policial MVP API funcionando"}

@app.get("/health")
async def health():
    return {"status": "healthy"}