from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    app_version: str = "1.0.0"
    refdata_snapshot_url: str = ""
    internal_jwt_public_key: str = ""
    models_dir: Path = Path("models")
    verify_model_checksums: bool = False
    red_flags_path: Path = Path("red-flags.yaml")
    face_transform_key_version: int = 1
    face_transform_seed_1: str = ""
    face_transform_seed_2: str = ""
    liveness_threshold: float = 0.80
    quality_min_enroll: float = 0.50
    quality_min_identify: float = 0.35
    llm_provider: str = "mock"
    llm_model: str = "mock"
    llm_api_key: str = ""
    llm_base_url: str = ""
    emergency_phone_number: str = "123"
    dataset_version: str = "seed-2026-11"
    engine_version: str = "rules-2026.11.1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
