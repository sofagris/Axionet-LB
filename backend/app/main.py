from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import logging

from alembic import command
from alembic.config import Config
from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.sysfs import SysfsInterfaceScanner

logger = logging.getLogger(__name__)


def run_migrations() -> None:
    settings = get_settings()
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    alembic_cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")


def bootstrap_interface_discovery() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        service = InterfaceDiscoveryService(
            db=db,
            scanner=SysfsInterfaceScanner(settings.host_sysfs_root),
        )
        interfaces, stats = service.rescan()
        logger.info(
            "Interface discovery bootstrap: discovered=%s created=%s updated=%s removed=%s total=%s",
            stats["discovered"],
            stats["created"],
            stats["updated"],
            stats["removed"],
            len(interfaces),
        )
    except Exception:
        logger.exception("Interface discovery bootstrap failed")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    run_migrations()
    bootstrap_interface_discovery()
    yield


def create_app(*, enable_lifespan: bool = True) -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan if enable_lifespan else None,
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
