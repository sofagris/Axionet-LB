from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.services.docker.client import create_docker_adapter
from app.services.instances.service import InstanceService
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.host import HostNetworkAdapter
from app.services.networking.mutation import InterfaceMutationService
from app.services.networking.pending_runtime import start_pending_store, stop_pending_store
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
        discovery = InterfaceDiscoveryService(
            db=db,
            scanner=SysfsInterfaceScanner(settings.host_sysfs_root),
        )
        interfaces, stats = discovery.rescan()
        logger.info(
            "Interface discovery bootstrap: discovered=%s created=%s updated=%s removed=%s total=%s",
            stats["discovered"],
            stats["created"],
            stats["updated"],
            stats["removed"],
            len(interfaces),
        )
        pending = start_pending_store()
        mutation = InterfaceMutationService(
            db=db,
            discovery=discovery,
            host_net=HostNetworkAdapter(use_host_nsenter=settings.host_net_nsenter),
            pending=pending,
            data_dir=settings.data_dir,
        )
        mutation.bootstrap_management_if_needed()
    except Exception:
        logger.exception("Interface discovery bootstrap failed")
    finally:
        db.close()


def run_reconcile_pass() -> int:
    settings = get_settings()
    db = SessionLocal()
    try:
        docker = create_docker_adapter(settings)
        service = InstanceService(db=db, docker=docker, settings=settings)
        return service.reconcile_all()
    finally:
        db.close()


async def reconcile_loop(stop_event: asyncio.Event) -> None:
    settings = get_settings()
    interval = settings.reconcile_interval_seconds
    logger.info("Reconcile loop started (interval=%ss)", interval)
    while not stop_event.is_set():
        try:
            count = await asyncio.to_thread(run_reconcile_pass)
            if count:
                logger.info("Reconcile pass updated %s instance(s)", count)
        except Exception:
            logger.exception("Reconcile loop pass failed")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except TimeoutError:
            continue
    logger.info("Reconcile loop stopped")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    run_migrations()
    bootstrap_interface_discovery()

    stop_event = asyncio.Event()
    task: asyncio.Task[None] | None = None
    if settings.reconcile_enabled:
        task = asyncio.create_task(reconcile_loop(stop_event), name="ax-reconcile-loop")

    yield

    stop_event.set()
    if task is not None:
        try:
            await asyncio.wait_for(task, timeout=settings.reconcile_interval_seconds + 5)
        except TimeoutError:
            task.cancel()
    stop_pending_store()


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
