import os
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

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            app_name=os.getenv("APP_NAME", "CodeStrike API"),
            app_env=os.getenv("APP_ENV", "development"),
            api_prefix=os.getenv("API_PREFIX", "/api/v1"),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            enable_docs=os.getenv("ENABLE_DOCS", "true").lower() in {"1", "true", "yes"},
            database_url=os.getenv("DATABASE_URL") or None,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_environment()

