"""
Vercel serverless: FastAPI backend pod /api/backend (ten sam projekt co Next.js).
Uruchamiane z roota repo; import z apps.api.
"""
import sys
from pathlib import Path

# apps/api w repo
_root = Path(__file__).resolve().parent
_api = _root / "apps" / "api"
if str(_api) not in sys.path:
    sys.path.insert(0, str(_api))

from fastapi import FastAPI

from main import app as api_app

parent = FastAPI(title="API Gateway")
parent.mount("/api/backend", api_app)
app = parent
