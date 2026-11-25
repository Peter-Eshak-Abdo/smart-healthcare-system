---
trigger: glob
globs: "ai-service/**/*.py, ai-service/pyproject.toml, packages/contracts/red-flags.yaml"
description: FastAPI AI service conventions (face, clinical rules, assistant)
---
# AI service conventions
- Python 3.12, FastAPI, Pydantic v2 (strict models mirroring docs/03 §13), mypy --strict, ruff.
- Every router depends on `require_internal` + `require_scope(...)`. The service is never exposed publicly.
- Face: images in memory only; no disk writes; never log/return raw embeddings; templates returned only AFTER the keyed
  orthogonal transform (app/face/transform.py). Model files verified by SHA256 at startup.
- Thresholds/config from pydantic-settings env; never hard-code.
- Clinical engine is deterministic over ref.* data; deterministic alert_key formats (docs/role-04 §3.4); highest severity wins.
- Assistant: red-flag rules run BEFORE the LLM; final triage = max(rule, llm); validator (docs/role-04 §5.6) is mandatory;
  user text only inside <user_message> delimiters; PII scrubbed before any provider call; temperature ≤ 0.3.
- Tests: pytest; red-flag recall must be 100% on the fixture suite; contract tests against packages/contracts/examples/internal.
