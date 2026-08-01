from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.auth_source import (
    LOCAL_AUTH_SOURCE_ID,
    LOCAL_UPN_SUFFIX,
    AppIdentityProvider,
    AuthSource,
    AuthUpnSuffix,
)
from app.schemas.auth_sources import (
    AppIdentityProviderCreate,
    AppIdentityProviderUpdate,
    AuthSourceCreate,
    AuthSourceUpdate,
    UpnSuffixCreate,
    UpnSuffixUpdate,
)


class AuthSourceError(ValueError):
    """Domain validation for auth sources / UPN suffixes / app IdPs."""


class AuthSourceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def ensure_local_source(self) -> AuthSource:
        source = self.db.get(AuthSource, LOCAL_AUTH_SOURCE_ID)
        if source is None:
            source = AuthSource(
                id=LOCAL_AUTH_SOURCE_ID,
                name="Local",
                kind="local",
                enabled=True,
                description="Built-in local user database (break-glass)",
            )
            self.db.add(source)
            self.db.flush()
        suffix = self.db.scalars(
            select(AuthUpnSuffix).where(AuthUpnSuffix.suffix == LOCAL_UPN_SUFFIX)
        ).first()
        if suffix is None:
            self.db.add(
                AuthUpnSuffix(suffix=LOCAL_UPN_SUFFIX, auth_source_id=LOCAL_AUTH_SOURCE_ID)
            )
            self.db.flush()
        self.db.commit()
        refreshed = self.db.get(AuthSource, LOCAL_AUTH_SOURCE_ID)
        assert refreshed is not None
        return refreshed

    def list_sources(self) -> list[AuthSource]:
        return list(self.db.scalars(select(AuthSource).order_by(AuthSource.name)).all())

    def get_source(self, source_id: str) -> AuthSource | None:
        return self.db.get(AuthSource, source_id)

    def create_source(self, payload: AuthSourceCreate) -> AuthSource:
        if payload.kind == "local":
            raise AuthSourceError("Cannot create additional local auth sources")
        name = payload.name.strip()
        if not name:
            raise AuthSourceError("Name is required")
        if self.db.scalars(select(AuthSource).where(AuthSource.name == name)).first():
            raise AuthSourceError("Auth source name already exists")
        if not payload.issuer_url or not payload.client_id:
            raise AuthSourceError("OIDC sources require issuer_url and client_id")
        source = AuthSource(
            name=name,
            kind="oidc",
            enabled=payload.enabled,
            description=payload.description or "",
            issuer_url=payload.issuer_url.strip(),
            client_id=payload.client_id.strip(),
            client_secret=payload.client_secret,
            scopes=payload.scopes or "openid profile email",
            claim_username=payload.claim_username or "preferred_username",
            claim_groups=payload.claim_groups or "groups",
        )
        self.db.add(source)
        self.db.commit()
        self.db.refresh(source)
        return source

    def update_source(self, source: AuthSource, payload: AuthSourceUpdate) -> AuthSource:
        if source.id == LOCAL_AUTH_SOURCE_ID and payload.enabled is False:
            raise AuthSourceError("Cannot disable the local auth source")
        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise AuthSourceError("Name is required")
            clash = self.db.scalars(
                select(AuthSource).where(AuthSource.name == name, AuthSource.id != source.id)
            ).first()
            if clash is not None:
                raise AuthSourceError("Auth source name already exists")
            source.name = name
        if payload.enabled is not None:
            source.enabled = payload.enabled
        if payload.description is not None:
            source.description = payload.description
        if source.kind == "oidc":
            if payload.issuer_url is not None:
                source.issuer_url = payload.issuer_url.strip() or None
            if payload.client_id is not None:
                source.client_id = payload.client_id.strip() or None
            if payload.client_secret is not None:
                if payload.client_secret != "":
                    source.client_secret = payload.client_secret
            if payload.scopes is not None:
                source.scopes = payload.scopes
            if payload.claim_username is not None:
                source.claim_username = payload.claim_username
            if payload.claim_groups is not None:
                source.claim_groups = payload.claim_groups
        self.db.commit()
        self.db.refresh(source)
        return source

    def delete_source(self, source: AuthSource) -> None:
        if source.id == LOCAL_AUTH_SOURCE_ID or source.kind == "local":
            raise AuthSourceError("Cannot delete the local auth source")
        count = self.db.scalar(
            select(func.count()).select_from(AuthUpnSuffix).where(
                AuthUpnSuffix.auth_source_id == source.id
            )
        )
        if count:
            raise AuthSourceError("Remove UPN suffix mappings before deleting the source")
        self.db.delete(source)
        self.db.commit()

    def list_suffixes(self) -> list[AuthUpnSuffix]:
        return list(
            self.db.scalars(
                select(AuthUpnSuffix)
                .options(selectinload(AuthUpnSuffix.auth_source))
                .order_by(AuthUpnSuffix.suffix)
            ).all()
        )

    def get_suffix(self, suffix_id: str) -> AuthUpnSuffix | None:
        return self.db.scalars(
            select(AuthUpnSuffix)
            .where(AuthUpnSuffix.id == suffix_id)
            .options(selectinload(AuthUpnSuffix.auth_source))
        ).first()

    def get_suffix_by_value(self, suffix: str) -> AuthUpnSuffix | None:
        normalized = suffix.strip().lower().lstrip("@")
        return self.db.scalars(
            select(AuthUpnSuffix)
            .where(AuthUpnSuffix.suffix == normalized)
            .options(selectinload(AuthUpnSuffix.auth_source))
        ).first()

    def create_suffix(self, payload: UpnSuffixCreate) -> AuthUpnSuffix:
        suffix = payload.suffix.strip().lower().lstrip("@")
        if not suffix:
            raise AuthSourceError("Suffix is required")
        if suffix == LOCAL_UPN_SUFFIX:
            raise AuthSourceError("Suffix 'internal' is reserved")
        if self.get_suffix_by_value(suffix) is not None:
            raise AuthSourceError("UPN suffix already exists")
        source = self.get_source(payload.auth_source_id)
        if source is None:
            raise AuthSourceError("Auth source not found")
        if not source.enabled:
            raise AuthSourceError("Auth source is disabled")
        row = AuthUpnSuffix(suffix=suffix, auth_source_id=source.id)
        self.db.add(row)
        self.db.commit()
        loaded = self.get_suffix(row.id)
        assert loaded is not None
        return loaded

    def update_suffix(self, row: AuthUpnSuffix, payload: UpnSuffixUpdate) -> AuthUpnSuffix:
        if row.suffix == LOCAL_UPN_SUFFIX:
            raise AuthSourceError("Cannot reassign the internal UPN suffix")
        if payload.auth_source_id is not None:
            source = self.get_source(payload.auth_source_id)
            if source is None:
                raise AuthSourceError("Auth source not found")
            row.auth_source_id = source.id
        self.db.commit()
        loaded = self.get_suffix(row.id)
        assert loaded is not None
        return loaded

    def delete_suffix(self, row: AuthUpnSuffix) -> None:
        if row.suffix == LOCAL_UPN_SUFFIX:
            raise AuthSourceError("Cannot delete the internal UPN suffix")
        self.db.delete(row)
        self.db.commit()

    def list_app_idps(self) -> list[AppIdentityProvider]:
        return list(
            self.db.scalars(select(AppIdentityProvider).order_by(AppIdentityProvider.name)).all()
        )

    def get_app_idp(self, idp_id: str) -> AppIdentityProvider | None:
        return self.db.get(AppIdentityProvider, idp_id)

    def create_app_idp(self, payload: AppIdentityProviderCreate) -> AppIdentityProvider:
        name = payload.name.strip()
        if not name:
            raise AuthSourceError("Name is required")
        if self.db.scalars(
            select(AppIdentityProvider).where(AppIdentityProvider.name == name)
        ).first():
            raise AuthSourceError("App identity provider name already exists")
        row = AppIdentityProvider(
            name=name,
            kind=payload.kind,
            enabled=payload.enabled,
            customer_id=payload.customer_id,
            config=payload.config or {},
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def update_app_idp(
        self, row: AppIdentityProvider, payload: AppIdentityProviderUpdate
    ) -> AppIdentityProvider:
        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise AuthSourceError("Name is required")
            clash = self.db.scalars(
                select(AppIdentityProvider).where(
                    AppIdentityProvider.name == name,
                    AppIdentityProvider.id != row.id,
                )
            ).first()
            if clash is not None:
                raise AuthSourceError("App identity provider name already exists")
            row.name = name
        if payload.kind is not None:
            row.kind = payload.kind
        if payload.enabled is not None:
            row.enabled = payload.enabled
        if payload.customer_id is not None:
            row.customer_id = payload.customer_id or None
        if payload.config is not None:
            row.config = payload.config
        self.db.commit()
        self.db.refresh(row)
        return row

    def delete_app_idp(self, row: AppIdentityProvider) -> None:
        self.db.delete(row)
        self.db.commit()
