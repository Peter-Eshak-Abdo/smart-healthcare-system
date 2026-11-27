from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from app.assistant.normalize import normalize_text

_NEGATORS = frozenset({"no", "not", "without", "never", "مفيش", "مش", "لا", "بدون", "عدم"})


@dataclass(frozen=True, slots=True)
class RedFlagRule:
    id: str
    level: str
    category: str | None
    groups: tuple[tuple[str, ...], ...]
    response_template: str


@dataclass(frozen=True, slots=True)
class RedFlagMatch:
    highest_level: str | None
    rule_ids: list[str]
    response_template: str | None
    category: str | None
    adjacent_keyword_hit: bool


def _contains_phrase(norm_text: str, phrase: str, *, allow_negation_filter: bool) -> bool:
    escaped = re.escape(phrase)
    pat = re.compile(rf"(?<!\w){escaped}(?!\w)")
    match = pat.search(norm_text)
    if not match:
        return False
    if not allow_negation_filter:
        return True
    prefix_tokens = norm_text[: match.start()].strip().split()
    window = prefix_tokens[-2:]
    return not any(tok in _NEGATORS for tok in window)


class RedFlagEngine:
    def __init__(self, version: str, rules: tuple[RedFlagRule, ...]) -> None:
        self.version = version
        self.rules = rules
        adj_terms: set[str] = set()
        for rule in rules:
            if len(rule.groups) > 1:
                for term in rule.groups[1]:
                    adj_terms.add(term)
        self._adjacent_terms = frozenset(adj_terms)

    @classmethod
    def from_yaml(cls, path: Path) -> RedFlagEngine:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        version = str(raw.get("version", "2026.11.1"))
        parsed_rules: list[RedFlagRule] = []
        for item in raw.get("rules", []):
            groups: list[tuple[str, ...]] = []
            for key in ("any_of", "with_any"):
                raw_groups = item.get(key)
                if raw_groups:
                    for grp in raw_groups:
                        terms = tuple(normalize_text(str(t)) for t in grp if str(t).strip())
                        if terms:
                            groups.append(terms)
            parsed_rules.append(
                RedFlagRule(
                    id=str(item["id"]),
                    level=str(item["level"]),
                    category=item.get("category"),
                    groups=tuple(groups),
                    response_template=str(item["response_template"]),
                )
            )
        return cls(version=version, rules=tuple(parsed_rules))

    def evaluate(self, raw_text: str) -> RedFlagMatch:
        norm = normalize_text(raw_text)
        matched: list[RedFlagRule] = []

        for rule in self.rules:
            ignore_negation = rule.level == "emergency" and len(rule.groups) >= 2
            all_groups_hit = True
            for grp in rule.groups:
                if not any(
                    _contains_phrase(norm, phrase, allow_negation_filter=not ignore_negation)
                    for phrase in grp
                ):
                    all_groups_hit = False
                    break
            if all_groups_hit and rule.groups:
                matched.append(rule)

        adjacent_hit = any(
            _contains_phrase(norm, term, allow_negation_filter=True)
            for term in self._adjacent_terms
        )

        if not matched:
            return RedFlagMatch(
                highest_level=None,
                rule_ids=[],
                response_template=None,
                category=None,
                adjacent_keyword_hit=adjacent_hit,
            )

        level_order = {"emergency": 2, "urgent": 1}
        matched.sort(key=lambda r: -level_order.get(r.level, 0))
        top = matched[0]
        return RedFlagMatch(
            highest_level=top.level,
            rule_ids=[r.id for r in matched],
            response_template=top.response_template,
            category=top.category,
            adjacent_keyword_hit=adjacent_hit,
        )
