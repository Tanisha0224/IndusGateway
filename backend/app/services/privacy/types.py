from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


PrivacyAction = Literal["allow", "mask_and_allow", "block"]
ResponsePrivacyAction = Literal["allow", "mask", "block"]


@dataclass(frozen=True)
class PIIFinding:
    entity_type: str
    start: int
    end: int
    confidence: float
    detector: str
    fingerprint: str
    value: str = field(repr=False, compare=False)

    def safe(self) -> dict[str, Any]:
        return {
            "entity_type": self.entity_type,
            "start": self.start,
            "end": self.end,
            "confidence": self.confidence,
            "detector": self.detector,
            "fingerprint": self.fingerprint,
        }


@dataclass
class EntityDecision:
    entity_type: str
    confidence: float
    action: PrivacyAction
    placeholder: str | None = None


@dataclass
class PrivacyDecision:
    action: PrivacyAction
    policy_ids: list[str]
    external_egress_allowed: bool
    mask_before_external_egress: bool
    allow_restoration: bool
    response_scan_enabled: bool
    entity_decisions: list[EntityDecision]


@dataclass
class MaskingResult:
    text: str
    placeholder_count: int
    masked_count: int


@dataclass
class PrivacyRequestResult:
    original_text: str
    sanitized_text: str
    findings: list[PIIFinding]
    decision: PrivacyDecision
    masked_count: int
    placeholder_count: int
    processing_ms: float

    @property
    def pii_types(self) -> list[str]:
        return sorted({finding.entity_type for finding in self.findings})
