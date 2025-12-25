from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str
    gemini_model: str = "gemini-1.5-flash"
    postgres_dsn: str
    redis_url: str
    s3_endpoint_url: str
    s3_access_key_id: str
    s3_secret_access_key: str
    s3_bucket: str
    s3_region: str = "us-east-1"
    app_env: str = "dev"
    app_port: int = 8000
    jwt_secret: str
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


def get_settings() -> Settings:
    return Settings()  # type: ignore
