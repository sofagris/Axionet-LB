#!/usr/bin/env python3
"""Validate packages/apps/* against docs/schemas (axionet.app/v1)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.app_packages.contract import validate_all_app_packages  # noqa: E402


def main() -> int:
    results = validate_all_app_packages(REPO_ROOT)
    if not results:
        print("No app packages found under packages/apps/")
        return 1

    failed = False
    for name, errors in sorted(results.items()):
        if errors:
            failed = True
            print(f"FAIL {name}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK   {name}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
