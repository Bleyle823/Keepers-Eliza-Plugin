"""Resolve KeeperHub API key from environment (Hermes plugins gate on requires_env)."""

from __future__ import annotations

import os

ENV_VAR_NAMES = ("KH_API_KEY", "KEEPERHUB_API_KEY", "KEEPERSHUB_API_KEY")


def first_string(*values: object) -> str | None:
    for value in values:
        if isinstance(value, str):
            t = value.strip()
            if t:
                return t
    return None


def resolve_api_key() -> str | None:
    """Same precedence as OpenClaw / Eliza: KH_, KEEPERHUB_, KEEPERSHUB_."""
    for name in ENV_VAR_NAMES:
        v = first_string(os.environ.get(name, ""))
        if v:
            return v
    return None


def is_likely_valid_api_key(api_key: str) -> bool:
    return api_key.startswith("kh_")


SUPPORTED_ENV_VARS: tuple[str, ...] = ENV_VAR_NAMES
