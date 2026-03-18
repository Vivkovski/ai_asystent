"""App config from environment."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = ""
    supabase_key: str = ""  # service_role for server
    supabase_jwt_secret: str = ""  # JWT secret for verifying access tokens

    # Google OAuth (Drive, Sheets): app-level
    google_client_id: str = ""
    google_client_secret: str = ""

    # OpenRouter (LLM: intent + answer synthesis); model chosen at openrouter.ai
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and (self.supabase_key or self.supabase_jwt_secret))


settings = Settings()
