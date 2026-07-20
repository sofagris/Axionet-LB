from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AxioNet LB"
    api_prefix: str = "/api/v1"
    data_dir: str = Field(
        default="/var/lib/ax-lb",
        validation_alias=AliasChoices("AX_LB_DATA_DIR", "DATA_DIR"),
    )
    database_url: str = Field(
        default="sqlite:////var/lib/ax-lb/ax-lb.db",
        validation_alias=AliasChoices("DATABASE_URL"),
    )
    log_level: str = Field(
        default="INFO",
        validation_alias=AliasChoices("AX_LOG_LEVEL", "LOG_LEVEL"),
    )
    docker_host: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DOCKER_HOST"),
    )
    docker_timeout_seconds: float = 5.0
    host_sysfs_root: str = Field(
        default="/sys",
        validation_alias=AliasChoices("HOST_SYSFS_ROOT", "AX_HOST_SYSFS_ROOT"),
        description="Sysfs root used for NIC discovery. Use /host/sys when host /sys is bind-mounted.",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
