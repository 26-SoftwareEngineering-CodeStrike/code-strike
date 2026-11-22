import os
import json
from functools import lru_cache

from pydantic import BaseModel, ConfigDict, Field


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)

    app_name: str = Field(default="CodeStrike API", min_length=1)
    app_env: str = Field(default="development", min_length=1)
    api_prefix: str = Field(default="/api/v1", pattern=r"^/api/v\d+$")
    log_level: str = Field(default="INFO", min_length=1)
    enable_docs: bool = True
    database_url: str | None = None
    token_ttl_seconds: int = Field(default=86400, ge=60)
    email_code_ttl_seconds: int = Field(default=600, ge=60)
    email_code_max_attempts: int = Field(default=5, ge=1)
    email_code_cooldown_seconds: int = Field(default=60, ge=1)
    auth_max_attempts: int = Field(default=10, ge=1)
    auth_window_seconds: int = Field(default=900, ge=1)
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_starttls: bool = True
    semester_start_date: str | None = None
    period_times: dict[str, list[str]] = Field(default_factory=dict)
    cors_origins: list[str] = Field(default_factory=list)

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            app_name=os.getenv("APP_NAME", "CodeStrike API"),
            app_env=os.getenv("APP_ENV", "development"),
            api_prefix=os.getenv("API_PREFIX", "/api/v1"),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            enable_docs=os.getenv("ENABLE_DOCS", "true").lower() in {"1", "true", "yes"},
            database_url=os.getenv("DATABASE_URL") or None,
            token_ttl_seconds=int(os.getenv("TOKEN_TTL_SECONDS", "86400")),
            email_code_ttl_seconds=int(os.getenv("EMAIL_CODE_TTL_SECONDS", "600")),
            email_code_max_attempts=int(os.getenv("EMAIL_CODE_MAX_ATTEMPTS", "5")),
            email_code_cooldown_seconds=int(os.getenv("EMAIL_CODE_COOLDOWN_SECONDS", "60")),
            auth_max_attempts=int(os.getenv("AUTH_MAX_ATTEMPTS", "10")),
            auth_window_seconds=int(os.getenv("AUTH_WINDOW_SECONDS", "900")),
            smtp_host=os.getenv("SMTP_HOST") or None,
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            smtp_username=os.getenv("SMTP_USERNAME") or None,
            smtp_password=os.getenv("SMTP_PASSWORD") or None,
            smtp_from=os.getenv("SMTP_FROM") or None,
            smtp_starttls=os.getenv("SMTP_STARTTLS", "true").lower() in {"1", "true", "yes"},
            semester_start_date=os.getenv("SEMESTER_START_DATE") or None,
            period_times=json.loads(os.getenv("PERIOD_TIMES", "{}")),
            cors_origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()],
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_environment()

