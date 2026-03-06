from datetime import datetime
from typing import Optional

import crud
import models
import schemas
from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Restaurant Management API",
    description="API para gestión de ventas y predicción de demanda",
    version="2.0.0",
)


# ── Dependencia de sesión ─────────────────────────────────


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Health checks ─────────────────────────────────────────


@app.get("/", tags=["Health"])
def root():
    return {"status": "API running", "version": "2.0.0"}


@app.get("/db_test", tags=["Health"])
def db_test():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db_status": "connected"}


# ── Productos ─────────────────────────────────────────────


@app.post(
    "/productos",
    response_model=schemas.ProductoResponse,
    status_code=201,
    tags=["Productos"],
)
def crear_producto(
    producto: schemas.ProductoCreate, db: Session = Depends(get_db)
):
    """Registrar un nuevo producto."""
    return crud.create_producto(db, producto)


@app.get(
    "/productos",
    response_model=list[schemas.ProductoResponse],
    tags=["Productos"],
)
def listar_productos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Listar todos los productos, con filtro opcional por categoría."""
    return crud.get_productos(db, skip=skip, limit=limit, categoria=categoria)


@app.get(
    "/productos/{producto_id}",
    response_model=schemas.ProductoResponse,
    tags=["Productos"],
)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    """Obtener un producto por ID."""
    producto = crud.get_producto(db, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@app.put(
    "/productos/{producto_id}",
    response_model=schemas.ProductoResponse,
    tags=["Productos"],
)
def actualizar_producto(
    producto_id: int,
    datos: schemas.ProductoUpdate,
    db: Session = Depends(get_db),
):
    """Actualizar campos de un producto (parcial)."""
    producto = crud.update_producto(db, producto_id, datos)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@app.delete(
    "/productos/{producto_id}",
    response_model=schemas.ProductoResponse,
    tags=["Productos"],
)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    """Eliminar un producto por ID."""
    producto = crud.delete_producto(db, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


# ── Ventas ────────────────────────────────────────────────


@app.post(
    "/ventas",
    response_model=schemas.VentaResponse,
    status_code=201,
    tags=["Ventas"],
)
def registrar_venta(venta: schemas.VentaCreate, db: Session = Depends(get_db)):
    """Registrar una venta. Valida que el producto exista."""
    producto = crud.get_producto(db, venta.id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return crud.create_venta(db, venta)


@app.get("/ventas", response_model=list[schemas.VentaResponse], tags=["Ventas"])
def listar_ventas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    id_producto: Optional[int] = Query(None),
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    """Listar ventas con filtros opcionales por producto y rango de fechas."""
    return crud.get_ventas(
        db,
        skip=skip,
        limit=limit,
        id_producto=id_producto,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@app.get(
    "/ventas/{venta_id}", response_model=schemas.VentaResponse, tags=["Ventas"]
)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    """Obtener una venta por ID."""
    venta = crud.get_venta(db, venta_id)
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta


# ── Métricas ──────────────────────────────────────────────


@app.get("/metricas/resumen", tags=["Métricas"])
def resumen_ventas(db: Session = Depends(get_db)):
    """Resumen general: total de ventas, ingresos y productos activos."""
    return crud.get_resumen_ventas(db)
