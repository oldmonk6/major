import asyncio
from typing import Any, Dict, List, Optional

import orjson
from fastapi import Depends, FastAPI
from fastapi.responses import ORJSONResponse
from sqlalchemy import text

from .auth import router as auth_router
from .config import Settings, get_settings
from .database import Base, engine
from .routes import router
from .storage import ensure_bucket

from fastapi.middleware.cors import CORSMiddleware


async def on_startup():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    ensure_bucket()


app = FastAPI(title="RECLAIM API", default_response_class=ORJSONResponse, on_startup=[on_startup])  # type: ignore[arg-type]

# Allow frontend origin in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(router)


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "RECLAIM backend is running"}
