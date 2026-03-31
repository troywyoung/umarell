from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    llm_provider: str = "gemini"  # "gemini" or "anthropic"
    database_url: str = "sqlite+aiosqlite:////app/data/umarell.db"
    cors_origins: str = "*"


settings = Settings()
