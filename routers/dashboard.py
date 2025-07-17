# Arquivo: routers/dashboard.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import schemas, models
from database import get_db
from crud import crud_dashboard
from .usuarios import get_current_active_user

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

@router.get("/summary", response_model=schemas.DashboardSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_dashboard.get_dashboard_summary(db=db)