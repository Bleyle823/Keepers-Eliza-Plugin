"""Pytest fixtures."""

from __future__ import annotations

import pytest

from keeperhub_plugin.client import reset_client_for_tests


@pytest.fixture(autouse=True)
def _reset_keeperhub_client():
    reset_client_for_tests()
    yield
    reset_client_for_tests()
