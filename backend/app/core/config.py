from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = ""
    development_database_url: str = "sqlite:///./sentinel_state.db"
    test_database_url: str = ""
    jwt_secret: str = "development-secret"
    encryption_key: str = ""
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800

    gateway_connect_timeout_seconds: float = 10
    gateway_read_timeout_seconds: float = 120
    gateway_max_body_bytes: int = 1_000_000
    pii_protection_enabled: bool = True
    pii_fail_mode: str = "closed"
    pii_engine: str = "deterministic"
    pii_max_text_characters: int = 100_000
    pii_response_scan_enabled: bool = True
    pii_allow_restoration: bool = False
    pii_store_sanitized_content: bool = False
    pii_log_content: bool = False
    streaming_privacy_enabled: bool = True
    streaming_privacy_mode: str = "buffered"
    streaming_fail_mode: str = "closed"
    streaming_max_buffer_characters: int = 200_000
    streaming_max_event_bytes: int = 1_048_576
    streaming_provider_timeout_seconds: float = 120
    streaming_output_chunk_characters: int = 256
    redis_url: str = "redis://localhost:6379/0"
    governance_enforcement_enabled: bool = True
    governance_fail_mode: str = "closed"
    governance_estimated_completion_tokens: int = 512
    governance_cost_per_1k_tokens_inr: float = 0.05
    provider_health_checks_enabled: bool = True
    provider_health_check_interval_seconds: int = 60
    provider_health_failure_threshold: int = 3
    provider_health_success_threshold: int = 2
    provider_health_half_open_after_seconds: int = 60

    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: str = ""
    india_hosted_llm_base_url: str = ""
    india_hosted_llm_api_key: str = ""
    gemini_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
