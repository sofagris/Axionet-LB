from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.plugins.haproxy.editor import HaproxyConfigEditor
from app.plugins.haproxy.renderer import render_haproxy_config
from app.plugins.haproxy.runtime import HaproxyRuntimeClient
from app.plugins.haproxy.schemas import (
    HaproxyAcl,
    HaproxyBackend,
    HaproxyCertificate,
    HaproxyConfig,
    HaproxyFrontend,
    HaproxyMap,
    HaproxyServer,
)
from app.schemas.haproxy import (
    HaproxyAclRead,
    HaproxyBackendRead,
    HaproxyCertificateCreate,
    HaproxyCertificateRead,
    HaproxyClearCountersResult,
    HaproxyConfigPreview,
    HaproxyDefaults,
    HaproxyFrontendRead,
    HaproxyMapCreate,
    HaproxyMapDetail,
    HaproxyMapRead,
    HaproxyRuntimeStatus,
    HaproxyServerRead,
    HaproxyServerRuntimeRequest,
    HaproxyServerRuntimeResult,
    HaproxyStatRow,
)
from app.services.audit.service import AuditService
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService

router = APIRouter(prefix="/instances/{instance_id}/haproxy", tags=["haproxy"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


def _require_instance(service: InstanceService, instance_id: str):
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    if instance.service_type != "haproxy":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a HAProxy instance")
    return instance


def _save(service: InstanceService, instance, editor: HaproxyConfigEditor):
    try:
        return service.apply_configuration(instance, editor.as_dict())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get("/config", response_model=HaproxyConfigPreview)
def get_config_preview(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyConfigPreview:
    instance = _require_instance(service, instance_id)
    config = HaproxyConfig.from_dict(instance.configuration)
    return HaproxyConfigPreview(
        configuration=config.model_dump(),
        rendered=render_haproxy_config(config),
    )


@router.get("/defaults", response_model=HaproxyDefaults)
def get_defaults(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyDefaults:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    return HaproxyDefaults.model_validate(editor.get_defaults())


@router.patch("/defaults", response_model=HaproxyDefaults)
def update_defaults(
    instance_id: str,
    payload: HaproxyDefaults,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyDefaults:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    updated = editor.update_defaults(
        mode=payload.mode,
        stats_port=payload.stats_port,
        timeout_connect=payload.timeout_connect,
        timeout_client=payload.timeout_client,
        timeout_server=payload.timeout_server,
    )
    _save(service, instance, editor)
    return HaproxyDefaults.model_validate(updated)


@router.get("/frontends", response_model=list[HaproxyFrontendRead])
def list_frontends(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> list[HaproxyFrontendRead]:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    return [HaproxyFrontendRead.model_validate(item.model_dump()) for item in editor.list_frontends()]


@router.post("/frontends", response_model=HaproxyFrontendRead, status_code=status.HTTP_201_CREATED)
def create_frontend(
    instance_id: str,
    payload: HaproxyFrontend,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyFrontendRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        item = editor.upsert_frontend(payload, create=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyFrontendRead.model_validate(item.model_dump())


@router.patch("/frontends/{frontend_name}", response_model=HaproxyFrontendRead)
def update_frontend(
    instance_id: str,
    frontend_name: str,
    payload: HaproxyFrontend,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyFrontendRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    if payload.name != frontend_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name mismatch")
    try:
        item = editor.upsert_frontend(payload, create=False)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyFrontendRead.model_validate(item.model_dump())


@router.delete("/frontends/{frontend_name}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_frontend(
    instance_id: str,
    frontend_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> Response:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        editor.delete_frontend(frontend_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/backends", response_model=list[HaproxyBackendRead])
def list_backends(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> list[HaproxyBackendRead]:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    return [HaproxyBackendRead.model_validate(item.model_dump()) for item in editor.list_backends()]


@router.post("/backends", response_model=HaproxyBackendRead, status_code=status.HTTP_201_CREATED)
def create_backend(
    instance_id: str,
    payload: HaproxyBackend,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyBackendRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        item = editor.upsert_backend(payload, create=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyBackendRead.model_validate(item.model_dump())


@router.patch("/backends/{backend_name}", response_model=HaproxyBackendRead)
def update_backend(
    instance_id: str,
    backend_name: str,
    payload: HaproxyBackend,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyBackendRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    if payload.name != backend_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name mismatch")
    try:
        item = editor.upsert_backend(payload, create=False)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyBackendRead.model_validate(item.model_dump())


@router.delete("/backends/{backend_name}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_backend(
    instance_id: str,
    backend_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> Response:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        editor.delete_backend(backend_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/backends/{backend_name}/servers", response_model=list[HaproxyServerRead])
def list_servers(
    instance_id: str,
    backend_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> list[HaproxyServerRead]:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        servers = editor.list_servers(backend_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [HaproxyServerRead.model_validate(item.model_dump()) for item in servers]


@router.post(
    "/backends/{backend_name}/servers",
    response_model=HaproxyServerRead,
    status_code=status.HTTP_201_CREATED,
)
def create_server(
    instance_id: str,
    backend_name: str,
    payload: HaproxyServer,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyServerRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        item = editor.upsert_server(backend_name, payload, create=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyServerRead.model_validate(item.model_dump())


@router.patch(
    "/backends/{backend_name}/servers/{server_name}",
    response_model=HaproxyServerRead,
)
def update_server(
    instance_id: str,
    backend_name: str,
    server_name: str,
    payload: HaproxyServer,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyServerRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    if payload.name != server_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name mismatch")
    try:
        item = editor.upsert_server(backend_name, payload, create=False)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyServerRead.model_validate(item.model_dump())


@router.delete(
    "/backends/{backend_name}/servers/{server_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_server(
    instance_id: str,
    backend_name: str,
    server_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> Response:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        editor.delete_server(backend_name, server_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/certificates", response_model=list[HaproxyCertificateRead])
def list_certificates(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> list[HaproxyCertificateRead]:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    return [
        HaproxyCertificateRead(
            name=item.name,
            filename=item.filename or f"certs/{item.name}.pem",
            size_bytes=service.certificate_size(instance, item.name),
        )
        for item in editor.list_certificates()
    ]


@router.post("/certificates", response_model=HaproxyCertificateRead, status_code=status.HTTP_201_CREATED)
def create_certificate(
    instance_id: str,
    payload: HaproxyCertificateCreate,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyCertificateRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        service.write_certificate_pem(instance, payload.name, payload.pem)
        item = editor.upsert_certificate(
            HaproxyCertificate(name=payload.name, filename=f"certs/{payload.name}.pem"),
            create=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyCertificateRead(
        name=item.name,
        filename=item.filename,
        size_bytes=service.certificate_size(instance, item.name),
    )


@router.put("/certificates/{certificate_name}", response_model=HaproxyCertificateRead)
def update_certificate(
    instance_id: str,
    certificate_name: str,
    payload: HaproxyCertificateCreate,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyCertificateRead:
    instance = _require_instance(service, instance_id)
    if payload.name != certificate_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name mismatch")
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        service.write_certificate_pem(instance, payload.name, payload.pem)
        item = editor.upsert_certificate(
            HaproxyCertificate(name=payload.name, filename=f"certs/{payload.name}.pem"),
            create=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyCertificateRead(
        name=item.name,
        filename=item.filename,
        size_bytes=service.certificate_size(instance, item.name),
    )


@router.delete(
    "/certificates/{certificate_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_certificate(
    instance_id: str,
    certificate_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> Response:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        editor.delete_certificate(certificate_name)
        service.delete_certificate_pem(instance, certificate_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/maps", response_model=list[HaproxyMapRead])
def list_maps(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> list[HaproxyMapRead]:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    return [
        HaproxyMapRead(
            name=item.name,
            filename=item.filename or f"maps/{item.name}.map",
            size_bytes=service.map_size(instance, item.name),
        )
        for item in editor.list_maps()
    ]


@router.get("/maps/{map_name}", response_model=HaproxyMapDetail)
def get_map(
    instance_id: str,
    map_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyMapDetail:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    item = editor.get_map(map_name)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    try:
        content = service.read_map_file(instance, map_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return HaproxyMapDetail(
        name=item.name,
        filename=item.filename or f"maps/{item.name}.map",
        size_bytes=service.map_size(instance, item.name),
        content=content,
    )


@router.post("/maps", response_model=HaproxyMapRead, status_code=status.HTTP_201_CREATED)
def create_map(
    instance_id: str,
    payload: HaproxyMapCreate,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyMapRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        service.write_map_file(instance, payload.name, payload.content)
        item = editor.upsert_map(
            HaproxyMap(name=payload.name, filename=f"maps/{payload.name}.map"),
            create=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyMapRead(
        name=item.name,
        filename=item.filename,
        size_bytes=service.map_size(instance, item.name),
    )


@router.put("/maps/{map_name}", response_model=HaproxyMapRead)
def update_map(
    instance_id: str,
    map_name: str,
    payload: HaproxyMapCreate,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyMapRead:
    instance = _require_instance(service, instance_id)
    if payload.name != map_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name mismatch")
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        service.write_map_file(instance, payload.name, payload.content)
        item = editor.upsert_map(
            HaproxyMap(name=payload.name, filename=f"maps/{payload.name}.map"),
            create=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyMapRead(
        name=item.name,
        filename=item.filename,
        size_bytes=service.map_size(instance, item.name),
    )


@router.delete(
    "/maps/{map_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_map(
    instance_id: str,
    map_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> Response:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        editor.delete_map(map_name)
        service.delete_map_file(instance, map_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/acls", response_model=list[HaproxyAclRead])
def list_acls(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> list[HaproxyAclRead]:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    return [HaproxyAclRead.model_validate(item.model_dump()) for item in editor.list_acls()]


@router.post("/acls", response_model=HaproxyAclRead, status_code=status.HTTP_201_CREATED)
def create_acl(
    instance_id: str,
    payload: HaproxyAcl,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyAclRead:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        item = editor.upsert_acl(payload, create=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyAclRead.model_validate(item.model_dump())


@router.patch("/acls/{acl_name}", response_model=HaproxyAclRead)
def update_acl(
    instance_id: str,
    acl_name: str,
    payload: HaproxyAcl,
    service: InstanceService = Depends(get_instance_service),
) -> HaproxyAclRead:
    instance = _require_instance(service, instance_id)
    if payload.name != acl_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name mismatch")
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        item = editor.upsert_acl(payload, create=False)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return HaproxyAclRead.model_validate(item.model_dump())


@router.delete("/acls/{acl_name}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_acl(
    instance_id: str,
    acl_name: str,
    service: InstanceService = Depends(get_instance_service),
) -> Response:
    instance = _require_instance(service, instance_id)
    editor = HaproxyConfigEditor(instance.configuration)
    try:
        editor.delete_acl(acl_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _save(service, instance, editor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/status", response_model=HaproxyRuntimeStatus)
def get_runtime_status(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
) -> HaproxyRuntimeStatus:
    instance = _require_instance(service, instance_id)
    if not instance.container_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Instance has no container")
    config = HaproxyConfig.from_dict(instance.configuration)
    runtime = HaproxyRuntimeClient(docker, stats_port=config.stats_port)
    try:
        csv_text = runtime.fetch_stats_csv(instance.container_id)
        rows = runtime.parse_stats(csv_text)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    frontends = [row for row in rows if row.svname == "FRONTEND"]
    backends = [row for row in rows if row.svname == "BACKEND"]
    servers = [row for row in rows if row.svname not in {"FRONTEND", "BACKEND"} and row.pxname]

    def to_stat(row) -> HaproxyStatRow:
        return HaproxyStatRow(
            proxy=row.pxname,
            server=row.svname,
            status=row.status,
            weight=row.weight or None,
            current_sessions=row.scur or None,
            max_sessions=row.smax or None,
            total_sessions=row.stot or None,
            bytes_in=row.bin or None,
            bytes_out=row.bout or None,
            check_status=row.check_status or None,
            check_code=row.check_code or None,
            downtime=row.downtime or None,
        )

    return HaproxyRuntimeStatus(
        instance_id=instance.id,
        available=True,
        frontends=[to_stat(row) for row in frontends],
        backends=[to_stat(row) for row in backends],
        servers=[to_stat(row) for row in servers],
    )


@router.post(
    "/runtime/servers/{backend_name}/{server_name}",
    response_model=HaproxyServerRuntimeResult,
)
def runtime_server_action(
    instance_id: str,
    backend_name: str,
    server_name: str,
    payload: HaproxyServerRuntimeRequest,
    service: InstanceService = Depends(get_instance_service),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    db: Session = Depends(get_db),
) -> HaproxyServerRuntimeResult:
    """Ephemeral runtime control via HAProxy admin socket (does not persist in config)."""
    instance = _require_instance(service, instance_id)
    if not instance.container_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Instance has no container")
    if payload.action == "set_weight" and payload.weight is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="weight is required")

    # Ensure rendered config includes TCP admin socket, then soft-reload once if needed.
    try:
        service.ensure_runtime_admin_socket(instance)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    runtime = HaproxyRuntimeClient(docker)
    try:
        output = runtime.server_action(
            instance.container_id,
            backend=backend_name,
            server=server_name,
            action=payload.action,
            weight=payload.weight,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    AuditService(db).record(
        event_type="haproxy.runtime.server",
        resource_type="instance",
        resource_id=instance.id,
        payload={
            "backend": backend_name,
            "server": server_name,
            "action": payload.action,
            "weight": payload.weight,
        },
        commit=True,
    )
    return HaproxyServerRuntimeResult(
        ok=True,
        backend=backend_name,
        server=server_name,
        action=payload.action,
        output=output,
        ephemeral=True,
    )


@router.post("/runtime/clear-counters", response_model=HaproxyClearCountersResult)
def clear_counters(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    db: Session = Depends(get_db),
) -> HaproxyClearCountersResult:
    """Reset HAProxy stats counters via admin socket (ephemeral until next clear/reload)."""
    instance = _require_instance(service, instance_id)
    if not instance.container_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Instance has no container")
    try:
        service.ensure_runtime_admin_socket(instance)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    runtime = HaproxyRuntimeClient(docker)
    try:
        output = runtime.clear_counters(instance.container_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="haproxy.runtime.clear_counters",
        resource_type="instance",
        resource_id=instance.id,
        payload={"name": instance.name},
        commit=True,
    )
    return HaproxyClearCountersResult(ok=True, output=output, ephemeral=True)
