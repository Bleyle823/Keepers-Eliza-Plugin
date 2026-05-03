"""Marketplace slug vs workflow-id heuristic."""

from keeperhub_plugin.tools_shared import NOT_FOUND_RE, looks_like_workflow_id


def test_looks_like_workflow_id():
    assert looks_like_workflow_id("abcdefghijklmnop") is True
    assert looks_like_workflow_id("abc-def-ghi") is False
    assert looks_like_workflow_id("short") is False


def test_not_found_regex():
    assert NOT_FOUND_RE.search("workflow not found")
    assert NOT_FOUND_RE.search("404 NOT FOUND")
