"""
Vercel serverless: FastAPI pod /api/python-api (wywoływane przez proxy z Next.js /api/backend/*).
"""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent
_api = _root / "apps" / "api"
if str(_api) not in sys.path:
    sys.path.insert(0, str(_api))

from fastapi import FastAPI

from main import app as api_app

parent = FastAPI(title="API Gateway")
parent.mount("/api/python-api", api_app)
parent.mount("/", api_app)
app = parent
