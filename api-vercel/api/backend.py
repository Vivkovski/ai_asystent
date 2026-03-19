"""
Vercel serverless (API-only project): FastAPI pod /api/backend.
Root Directory = api-vercel; build kopiuje ../apps, więc apps/api jest dostępne.
"""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
_api = _root / "apps" / "api"
if str(_api) not in sys.path:
    sys.path.insert(0, str(_api))

from fastapi import FastAPI

from main import app as api_app

parent = FastAPI(title="API Gateway")
parent.mount("/api/backend", api_app)
parent.mount("/", api_app)
app = parent
