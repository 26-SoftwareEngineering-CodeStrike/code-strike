from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)

from app.modules.auth.router import router as auth_router
from app.modules.profiles.router import router as profiles_router
from app.modules.skills.router import router as skills_router
from app.modules.teams.router import router as teams_router
from app.modules.notifications.router import router as notifications_router
from app.modules.planner.router import router as planner_router
from app.modules.competitions.router import router as competitions_router
from app.modules.content.router import router as content_router
from app.modules.moderation.router import router as moderation_router
from app.api.v1.routes.dashboard import router as dashboard_router

for router in (auth_router, profiles_router, skills_router, teams_router,
               notifications_router, planner_router, competitions_router, content_router,
               moderation_router, dashboard_router):
    api_router.include_router(router)

