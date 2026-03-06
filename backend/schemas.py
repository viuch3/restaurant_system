from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional


# ── Producto ──────────────────────────────────────────────


class ProductoBase(BaseModel):
    nombre: str = Field(
        ..., min_length=1, max_length=100, examples=["Hamburguesa Clásica"]
    )
    categoria: str = Field(
        ..., min_length=1, max_length=50, examples=["Comida"]
    )
    precio: float = Field(
        ..., gt=0, description="Precio de venta (debe ser positivo)"
    )
    costo: float = Field(
        ..., gt=0, description="Costo de producción (debe ser positivo)"
    )

    @model_validator(mode="after")
    def precio_mayor_que_costo(self):
        if self.precio <= self.costo:
            raise ValueError("El precio de venta debe ser mayor que el costo")
        return self


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    categoria: Optional[str] = Field(None, min_length=1, max_length=50)
    precio: Optional[float] = Field(None, gt=0)
    costo: Optional[float] = Field(None, gt=0)


class ProductoResponse(ProductoBase):
    id: int

    model_config = {"from_attributes": True}


# ── Venta ─────────────────────────────────────────────────


class VentaBase(BaseModel):
    id_producto: int = Field(..., gt=0)
    cantidad: int = Field(
        ..., gt=0, description="Cantidad vendida (debe ser positiva)"
    )
    precio_unitario: float = Field(
        ..., gt=0, description="Precio unitario al momento de la venta"
    )
    fecha: Optional[datetime] = Field(
        None, description="Fecha de la venta (default: ahora)"
    )


class VentaCreate(VentaBase):
    pass


class VentaResponse(VentaBase):
    id: int
    fecha: datetime

    model_config = {"from_attributes": True}
