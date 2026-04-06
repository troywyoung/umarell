from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    llm_provider: str = "gemini"  # "gemini" or "anthropic"
    tavily_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:////app/data/umarell.db"
    cors_origins: str = "*"
    google_client_id: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_expire_days: int = 30
    admin_email: str = ""  # Set to your Google account email for master admin access
    railway_staging_deploy_hook: str = ""  # Railway deploy webhook URL for staging service
    supadata_api_key: str = ""  # Supadata API key for YouTube transcript fallback


settings = Settings()
