"""Hermes plugin: compaction-gated AGENTS.md reload, zero content-marker pins.

Ships inside Hermes' own process as a plugin, so it can call Hermes' public
summary classifiers (`is_compaction_summary_message` and the synthetic-turn
check on `ContextCompressor`) directly. No byte-pinned summary prefixes are
duplicated here — the classifiers track upstream marker changes automatically.
Recommended over the shell-hook variant when plugin installs are acceptable;
the shell hook (`hooks.pre_llm_call` in config.yaml) remains the fallback for
environments that do not load user plugins.

Drop this directory into ~/.hermes/plugins/agents-compact-reload/ (or install
with `node scripts/install.mjs --target hermes --plugin`).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger("plugins.agents-compact-reload")

_MAX_BYTES = 32 * 1024


def _registered_root(cwd: str) -> str | None:
    """Read the installer's projects.json and select the project containing cwd.

    projects.json lives in the shared hook install directory
    ($HERMES_HOME/hooks/agents-compact-reload/); this plugin is installed at
    $HERMES_HOME/plugins/agents-compact-reload/ alongside it in Hermes' user
    plugin tree.
    """
    shared_dir = Path(__file__).resolve().parent.parent.parent / "hooks" / "agents-compact-reload"
    projects_path = shared_dir / "projects.json"
    legacy_path = Path(__file__).resolve().parent / "projects.json"
    projects_path = projects_path if projects_path.is_file() else legacy_path
    try:
        config = json.loads(projects_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    entries = config.get("projects") if isinstance(config, dict) else None
    if not isinstance(entries, list):
        return None

    def _key(value: str) -> str:
        return os.path.normcase(os.path.normpath(value))

    resolved_cwd = _key(cwd)
    best = None
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        root = entry.get("root")
        if not isinstance(root, str) or not root:
            continue
        key = _key(root)
        inside = resolved_cwd == key or resolved_cwd.startswith(key + os.sep)
        if inside and (best is None or len(key) > len(best[0])):
            best = (key, root)
    return best[1] if best else None


def _read_agents_md(root: str) -> tuple[str, str] | None:
    """Read the registered root AGENTS.md within the 32 KiB cap; None when unavailable."""
    path = Path(root) / "AGENTS.md"
    try:
        if not path.is_file():
            return None
        data = path.read_bytes()
    except OSError:
        return None
    if not data or len(data) > _MAX_BYTES:
        return None
    try:
        return data.decode("utf-8"), path.as_posix()
    except UnicodeDecodeError:
        return None


def _is_compaction_boundary(message: dict) -> bool:
    """Zero-pin detection using Hermes' own public classifiers."""
    from agent.context_compressor import ContextCompressor, is_compaction_summary_message

    if is_compaction_summary_message(message):
        return True
    # The no-user-turn continuation row is a synthetic user turn, not a summary.
    return bool(ContextCompressor._is_synthetic_compression_user_turn(message))


def register(ctx) -> None:
    def on_pre_llm_call(**kwargs):
        try:
            # Hermes compacts at TURN START: the immediate post-compaction turn
            # usually carries a live user message AFTER the summary row, so a
            # live user message does NOT mean the summary is stale. Fire on the
            # first turn whose history contains a compaction handoff; dedupe on
            # session_id + summary identity (in-process memory is enough here —
            # the plugin lives in the agent process).
            history = kwargs.get("conversation_history") or []
            boundary = None
            for message in reversed(history):
                if isinstance(message, dict) and _is_compaction_boundary(message):
                    boundary = message
                    break
            if boundary is None:
                return None
            session_id = str(kwargs.get("session_id") or "")
            key = (session_id, _summary_identity(boundary))
            if not _should_fire(key):
                return None
            cwd = os.getcwd()
            root = _registered_root(cwd)
            if root is None:
                return None
            loaded = _read_agents_md(root)
            if loaded is None:
                return None
            text, source = loaded
            sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
            context = (
                "Post-compaction project instructions were reloaded from the registered Git root.\n"
                f"Project: {Path(root).name}\n"
                f"Source: {source}\n"
                f"SHA-256: {sha256}\n\n"
                "<project-agents-md>\n"
                f"{text}\n"
                "</project-agents-md>"
            )
            return {"context": context}
        except Exception:
            logger.warning("agents-compact-reload pre_llm_call hook failed", exc_info=True)
            return None

    ctx.register_hook("pre_llm_call", on_pre_llm_call)


def _summary_identity(message: dict) -> str:
    import hashlib as _hashlib

    from agent.context_compressor import _content_text_for_contains

    return _hashlib.sha256(_content_text_for_contains(message.get("content")).encode("utf-8")).hexdigest()[:16]


_FIRED: dict[tuple, float] = {}
_FIRED_TTL_SECONDS = 12 * 60 * 60


def _should_fire(key: tuple) -> bool:
    import time

    now = time.monotonic()
    for k, ts in list(_FIRED.items()):
        if now - ts > _FIRED_TTL_SECONDS:
            del _FIRED[k]
    if key in _FIRED:
        return False
    _FIRED[key] = now
    return True
