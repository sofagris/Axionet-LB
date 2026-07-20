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
    host_proc_root: str = Field(
        default="/host/proc",
        validation_alias=AliasChoices("HOST_PROC_ROOT", "AX_HOST_PROC_ROOT"),
        description="Proc root for host CPU/memory metrics. Falls back to /proc when missing.",
    )
    host_net_nsenter: bool = Field(
        default=True,
        validation_alias=AliasChoices("HOST_NET_NSENTER", "AX_HOST_NET_NSENTER"),
        description="Use nsenter into PID 1 netns for VLAN device management.",
    )
    reconcile_interval_seconds: float = Field(
        default=15.0,
        ge=5.0,
        le=600.0,
        validation_alias=AliasChoices("RECONCILE_INTERVAL_SECONDS", "AX_RECONCILE_INTERVAL_SECONDS"),
        description="Background reconcile loop interval. Set high to reduce Docker chatter.",
    )
    reconcile_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("RECONCILE_ENABLED", "AX_RECONCILE_ENABLED"),
        description="Run the background desired/actual reconcile loop.",
    )
    auth_secret_key: str = Field(
        default="axionet-lb-dev-secret-change-me",
        validation_alias=AliasChoices("AX_AUTH_SECRET_KEY", "AUTH_SECRET_KEY"),
        description="HMAC secret for JWT access tokens.",
    )
    auth_token_expire_hours: int = Field(
        default=12,
        ge=1,
        le=168,
        validation_alias=AliasChoices("AX_AUTH_TOKEN_EXPIRE_HOURS", "AUTH_TOKEN_EXPIRE_HOURS"),
    )
    auth_default_admin_username: str = Field(
        default="Admin",
        validation_alias=AliasChoices("AX_AUTH_DEFAULT_ADMIN_USERNAME"),
    )
    auth_default_admin_password: str = Field(
        default="Password",
        validation_alias=AliasChoices("AX_AUTH_DEFAULT_ADMIN_PASSWORD"),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
