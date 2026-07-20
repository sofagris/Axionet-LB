from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import haproxy as haproxy_routes
from app.api.v1 import instances as instances_routes
from app.api.v1 import system as system_routes
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.service_instance import ActualState, DesiredState, HealthStatus, ServiceInstance
from app.plugins.haproxy.validator import ValidationResult
from app.services.docker.client import DockerClientAdapter


CSV_SAMPLE = """\
# pxname,svname,qcur,qmax,scur,smax,slim,stot,bin,bout,dreq,dresp,ereq,econ,eresp,wretr,wredis,status,weight,act,bck,chkfail,chkdown,lastchg,downtime,qlimit,pid,iid,sid,throttle,lbtot,tracked,type,rate,rate_lim,rate_max,check_status,check_code,check_duration,hrsp_1xx,hrsp_2xx,hrsp_3xx,hrsp_4xx,hrsp_5xx,hrsp_other,hanafail,req_rate,req_rate_max,req_tot,cli_abrt,srv_abrt,comp_in,comp_out,comp_byp,comp_rsp,lastsess,last_chk,last_agt,qtime,ctime,rtime,ttime,
stats,FRONTEND,,,1,5,2000,100,1000,2000,0,0,2,,,,,OPEN,,,,,,,,,1,1,0,,,,0,3,0,0,,,,,,,,,,,0,0,0,,,0,0,0,0,,,,,,,,
main,FRONTEND,,,4,10,2000,500,9000,8000,0,0,1,,,,,OPEN,,,,,,,,,1,2,0,,,,0,7,0,0,,,,,,,,,,,0,0,0,,,0,0,0,0,,,,,,,,
app,BACKEND,0,0,4,10,200,500,9000,8000,0,0,,3,1,0,0,UP,0,0,0,,0,1,0,,1,3,0,,0,,1,0,,0,,,,0,0,0,0,0,0,,,,0,0,0,0,0,0,,,,,0,,,0,0,0,0,
app,s1,0,0,3,8,,400,7000,6000,,0,,0,0,0,0,UP,100,1,0,0,0,1,0,,1,3,1,,0,,2,0,,0,L4OK,,0,0,0,0,0,0,0,0,,,,0,0,,,,,0,,,0,0,0,0,
app,s2,0,0,0,0,,0,0,0,,0,,1,2,0,0,DOWN,100,1,0,0,1,1,30,,1,3,2,,0,,2,0,,0,L4TOUT,,0,0,0,0,0,0,0,0,,,,0,0,,,,,0,,,0,0,0,0,
"""


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    session.add(
        ServiceInstance(
            id="inst-1",
            name="edge-1",
            service_type="haproxy",
            desired_state=DesiredState.STOPPED.value,
            actual_state=ActualState.STOPPED.value,
            image="haproxy:3.2.6",
            image_version="3.2.6",
            configuration={},
            container_id="container-1",
            container_name="ax-haproxy-inst1",
            health_status=HealthStatus.UNKNOWN.value,
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def docker_adapter(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    adapter = MagicMock(spec=DockerClientAdapter)
    adapter.run_network_sidecar.return_value = CSV_SAMPLE
    from app.plugins.haproxy import validator as validator_mod

    monkeypatch.setattr(
        validator_mod.HaproxyConfigValidator,
        "validate_config_dict",
        lambda self, configuration: ValidationResult(ok=True, output="ok"),
    )
    return adapter


@pytest.fixture()
def client(db_session: Session, docker_adapter: MagicMock) -> Generator[TestClient, None, None]:
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[haproxy_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[instances_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[system_routes.get_docker_adapter] = lambda: docker_adapter

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_haproxy_structured_crud_and_status(
    client: TestClient,
    docker_adapter: MagicMock,
    db_session: Session,
) -> None:
    created = client.post(
        "/api/v1/instances/inst-1/haproxy/frontends",
        json={
            "name": "api",
            "bind_address": "*",
            "bind_port": 8080,
            "mode": "http",
            "default_backend": "app",
        },
    )
    assert created.status_code == 201, created.text

    server = client.post(
        "/api/v1/instances/inst-1/haproxy/backends/app/servers",
        json={
            "name": "api1",
            "address": "10.10.0.5",
            "port": 80,
            "check": True,
            "weight": 80,
            "inter_ms": 1000,
            "rise": 2,
            "fall": 3,
        },
    )
    assert server.status_code == 201, server.text

    listed = client.get("/api/v1/instances/inst-1/haproxy/backends/app/servers")
    assert listed.status_code == 200
    assert any(item["name"] == "api1" for item in listed.json())

    preview = client.get("/api/v1/instances/inst-1/haproxy/config")
    assert preview.status_code == 200
    assert "frontend api" in preview.json()["rendered"]
    assert "server api1 10.10.0.5:80" in preview.json()["rendered"]

    status = client.get("/api/v1/instances/inst-1/haproxy/status")
    assert status.status_code == 200
    body = status.json()
    assert body["available"] is True
    assert any(row["server"] == "FRONTEND" for row in body["frontends"])
    assert any(row["server"] == "s1" for row in body["servers"])
    docker_adapter.run_network_sidecar.assert_called()

    updated_fe = client.patch(
        "/api/v1/instances/inst-1/haproxy/frontends/api",
        json={
            "name": "api",
            "bind_address": "*",
            "bind_port": 8081,
            "mode": "http",
            "default_backend": "app",
        },
    )
    assert updated_fe.status_code == 200, updated_fe.text
    assert updated_fe.json()["bind_port"] == 8081

    updated_srv = client.patch(
        "/api/v1/instances/inst-1/haproxy/backends/app/servers/api1",
        json={
            "name": "api1",
            "address": "10.10.0.6",
            "port": 80,
            "check": True,
            "weight": 50,
            "inter_ms": 1000,
            "rise": 2,
            "fall": 3,
        },
    )
    assert updated_srv.status_code == 200, updated_srv.text
    assert updated_srv.json()["weight"] == 50
    assert updated_srv.json()["address"] == "10.10.0.6"

    metrics = client.get("/api/v1/instances/inst-1/metrics")
    assert metrics.status_code == 200
    mbody = metrics.json()
    assert mbody["available"] is True
    assert mbody["current_sessions"] == 5
    assert mbody["bytes_in"] == 10_000
    assert mbody["servers_up"] == 1
    assert mbody["servers_down"] == 1

    # Fleet metrics only include running-ish instances; mark running in DB first.
    from app.models.service_instance import ActualState, ServiceInstance

    inst = db_session.get(ServiceInstance, "inst-1")
    assert inst is not None
    inst.actual_state = ActualState.RUNNING.value
    db_session.commit()

    fleet = client.get("/api/v1/system/lb-metrics")
    assert fleet.status_code == 200
    fbody = fleet.json()
    assert fbody["totals"]["instances_available"] == 1
    assert fbody["totals"]["current_sessions"] == 5
    assert fbody["totals"]["bytes_out"] == 10_000
