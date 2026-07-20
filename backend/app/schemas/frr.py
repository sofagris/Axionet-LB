from pydantic import BaseModel, Field


class FrrConfigPreview(BaseModel):
    configuration: dict
    rendered: str


class FrrBgpStatus(BaseModel):
    summary: str
    neighbors: str = ""


class FrrConfigUpdate(BaseModel):
    hostname: str | None = None
    router_id: str | None = None
    local_as: int | None = Field(default=None, ge=1, le=4294967295)
    neighbors: list[dict] | None = None
    networks: list[str] | None = None
    log_stdout: bool | None = None
