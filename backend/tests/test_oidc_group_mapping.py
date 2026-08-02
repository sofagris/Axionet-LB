from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.roles import effective_role
from app.models.auth_source import AuthSource
from app.models.group import Group, UserGroup
from app.services.auth_sources.oidc import upsert_oidc_user


def test_oidc_group_claim_maps_to_local_group_effective_role(db_session: Session) -> None:
    source = AuthSource(
        name="Test OIDC",
        kind="oidc",
        enabled=True,
        description="",
        issuer_url="http://example.test/realms/x",
        client_id="gui",
        claim_username="preferred_username",
        claim_groups="groups",
    )
    db_session.add(source)
    # Local GUI seed uses "Operators"; Keycloak claim is lowercase "operators".
    ops = Group(name="Operators", description="ops", role="operator")
    db_session.add(ops)
    db_session.commit()

    user = upsert_oidc_user(
        db_session,
        source=source,
        claims={
            "sub": "oidc-sub-1",
            "preferred_username": "labuser",
            "email": "labuser@lab.local",
            "groups": ["operators"],
        },
        upn_hint="labuser@lab.local",
    )

    assert user.role == "viewer"
    assert effective_role(user) == "operator"
    memberships = list(
        db_session.scalars(select(UserGroup).where(UserGroup.user_id == user.id)).all()
    )
    assert len(memberships) == 1
    assert memberships[0].group_id == ops.id


def test_oidc_unknown_groups_do_not_grant_role(db_session: Session) -> None:
    source = AuthSource(
        name="Test OIDC 2",
        kind="oidc",
        enabled=True,
        description="",
        issuer_url="http://example.test/realms/y",
        client_id="gui",
        claim_username="preferred_username",
        claim_groups="groups",
    )
    db_session.add(source)
    db_session.commit()

    user = upsert_oidc_user(
        db_session,
        source=source,
        claims={
            "sub": "oidc-sub-2",
            "preferred_username": "nobody",
            "groups": ["does-not-exist"],
        },
        upn_hint=None,
    )
    assert user.role == "viewer"
    assert effective_role(user) == "viewer"
    assert (
        db_session.scalars(select(UserGroup).where(UserGroup.user_id == user.id)).first()
        is None
    )


def test_oidc_empty_groups_claim_clears_memberships(db_session: Session) -> None:
    source = AuthSource(
        name="Test OIDC 3",
        kind="oidc",
        enabled=True,
        description="",
        issuer_url="http://example.test/realms/z",
        client_id="gui",
        claim_username="preferred_username",
        claim_groups="groups",
    )
    ops = Group(name="operators", description="ops", role="operator")
    db_session.add_all([source, ops])
    db_session.commit()

    user = upsert_oidc_user(
        db_session,
        source=source,
        claims={"sub": "oidc-sub-3", "preferred_username": "lab", "groups": ["operators"]},
        upn_hint=None,
    )
    assert effective_role(user) == "operator"

    user = upsert_oidc_user(
        db_session,
        source=source,
        claims={"sub": "oidc-sub-3", "preferred_username": "lab", "groups": []},
        upn_hint=None,
    )
    assert user.role == "viewer"
    assert effective_role(user) == "viewer"
    assert (
        db_session.scalars(select(UserGroup).where(UserGroup.user_id == user.id)).first()
        is None
    )
