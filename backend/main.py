from fastapi import FastAPI
from sqlalchemy import text

from database import engine

app = FastAPI()


@app.get("/")
def root():
    return {"status": "API running"}


@app.get("/db_test")
def db_test():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        return {"db_status": "connected"}
