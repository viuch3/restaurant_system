from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional

import models
import schemas


# ── Productos ─────────────────────────────────────────────


def get_producto(db: Session, producto_id: int):
    return (
        db.query(models.Product)
        .filter(models.Product.id == producto_id)
        .first()
    )


def get_productos(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    categoria: Optional[str] = None,
):
    query = db.query(models.Product)
    if categoria:
        query = query.filter(models.Product.categoria == categoria)
    return query.offset(skip).limit(limit).all()


def create_producto(db: Session, producto: schemas.ProductoCreate):
    db_producto = models.Product(**producto.model_dump())
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return db_producto


def update_producto(
    db: Session, producto_id: int, datos: schemas.ProductoUpdate
):
    db_producto = get_producto(db, producto_id)
    if not db_producto:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(db_producto, campo, valor)
    db.commit()
    db.refresh(db_producto)
    return db_producto


def delete_producto(db: Session, producto_id: int):
    db_producto = get_producto(db, producto_id)
    if not db_producto:
        return None
    db.delete(db_producto)
    db.commit()
    return db_producto


# ── Ventas ────────────────────────────────────────────────


def get_venta(db: Session, venta_id: int):
    return db.query(models.Sale).filter(models.Sale.id == venta_id).first()


def get_ventas(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    id_producto: Optional[int] = None,
    fecha_desde: Optional[datetime] = None,
    fecha_hasta: Optional[datetime] = None,
):
    query = db.query(models.Sale)
    if id_producto:
        query = query.filter(models.Sale.id_producto == id_producto)
    if fecha_desde:
        query = query.filter(models.Sale.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(models.Sale.fecha <= fecha_hasta)
    return (
        query.order_by(models.Sale.fecha.desc()).offset(skip).limit(limit).all()
    )


def create_venta(db: Session, venta: schemas.VentaCreate):
    datos = venta.model_dump()
    if datos.get("fecha") is None:
        datos["fecha"] = datetime.utcnow()
    db_venta = models.Sale(**datos)
    db.add(db_venta)
    db.commit()
    db.refresh(db_venta)
    return db_venta


# ── Métricas básicas ──────────────────────────────────────


def get_resumen_ventas(db: Session):
    total_ventas = db.query(func.count(models.Sale.id)).scalar()
    total_ingresos = (
        db.query(
            func.sum(models.Sale.cantidad * models.Sale.precio_unitario)
        ).scalar()
        or 0.0
    )
    productos_activos = db.query(func.count(models.Product.id)).scalar()
    return {
        "total_ventas": total_ventas,
        "total_ingresos": round(total_ingresos, 2),
        "productos_activos": productos_activos,
    }
