"""Explicit model registry used by migrations and tests, never schema creation on startup."""
from app.modules.auth import models as auth
from app.modules.profiles import models as profiles
from app.modules.skills import models as skills
from app.modules.competitions import models as competitions
from app.modules.content import models as content
from app.modules.moderation import models as moderation
from app.modules.teams import models as teams
from app.modules.notifications import models as notifications
from app.modules.planner import models as planner
