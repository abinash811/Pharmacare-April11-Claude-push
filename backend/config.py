from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost/pharmacare"

    @field_validator("DATABASE_URL")
    @classmethod
    def _use_asyncpg_driver(cls, v: str) -> str:
        # Hosted Postgres providers (Render, Railway, Heroku-style) hand out
        # a plain postgres:// or postgresql:// connection string — our async
        # engine (database.py, migrations/env.py) requires the +asyncpg
        # driver explicitly, or it errors at connect time. Local dev's own
        # .env already sets the full scheme, so this is a no-op there.
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # App
    APP_NAME: str = "PharmaCare"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # JWT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    @field_validator("SECRET_KEY")
    @classmethod
    def _refuse_default_secret_outside_debug(cls, v: str, info) -> str:
        # docs/14_SECURITY.md KNOWN GAPS #1: the app used to start anyway
        # with this literal fallback, silently signing every JWT with a
        # string anyone reading this repo already knows — a forgeable
        # token for any user. DEBUG defaults to False, so a deploy that
        # forgets to set SECRET_KEY now fails loudly at startup instead.
        debug = info.data.get("DEBUG", False)
        if not debug and v == "change-me-in-production":
            raise ValueError(
                "SECRET_KEY is still the default placeholder. Set a real "
                "random SECRET_KEY env var before starting outside DEBUG mode."
            )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
