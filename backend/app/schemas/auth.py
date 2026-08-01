from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.identity import UserRead

__all__ = ["LoginRequest", "TokenResponse", "UserRead"]


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead
