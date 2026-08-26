from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.core.errors import pii_detection_failed, pii_masking_failed, pii_policy_blocked, request_too_large
from app.services.privacy.detector import DETECTOR_VERSION, PIIDetector
from app.services.privacy.masker import PIIMasker
from app.services.privacy.policy import PrivacyPolicyEvaluator
from app.services.privacy.types import PIIFinding, PrivacyRequestResult


@dataclass
class ResponseScanResult:
    text: str
    findings: list[PIIFinding]
    masked_count: int
    action: str


class PrivacyFirewall:
    def __init__(self) -> None:
        self.detector = PIIDetector()
        self.evaluator = PrivacyPolicyEvaluator()

    @property
    def detector_version(self) -> str:
        return DETECTOR_VERSION

    def inspect_text(self, project_id: str, text: str) -> PrivacyRequestResult:
        settings = get_settings()
        started = time.perf_counter()
        if not settings.pii_protection_enabled:
            decision = self.evaluator.evaluate(project_id, [])
            return PrivacyRequestResult(text, text, [], decision, 0, 0, 0)
        if len(text) > settings.pii_max_text_characters:
            raise request_too_large("Request text exceeds the privacy scanning limit.")
        try:
            findings = self.detector.detect(text)
            decision = self.evaluator.evaluate(project_id, findings)
            if decision.action == "block":
                raise pii_policy_blocked()
            sanitized = text
            masked_count = 0
            placeholder_count = 0
            if decision.action == "mask_and_allow" or (findings and decision.mask_before_external_egress):
                maskable = [finding for finding in findings if self._action_for(finding, decision) == "mask_and_allow"]
                masked = PIIMasker().mask(text, maskable)
                sanitized = masked.text
                masked_count = masked.masked_count
                placeholder_count = masked.placeholder_count
            elapsed = round((time.perf_counter() - started) * 1000, 2)
            return PrivacyRequestResult(text, sanitized, findings, decision, masked_count, placeholder_count, elapsed)
        except Exception:
            if settings.pii_fail_mode == "open":
                decision = self.evaluator.evaluate(project_id, [])
                return PrivacyRequestResult(text, text, [], decision, 0, 0, round((time.perf_counter() - started) * 1000, 2))
            raise

    def simulate_text(self, project_id: str, text: str) -> dict[str, Any]:
        result = self.inspect_text(project_id, text)
        return {
            "decision": result.decision.action,
            "entities": [
                {
                    "type": item.entity_type,
                    "confidence": item.confidence,
                    "action": self._action_for(item, result.decision),
                    "placeholder": PIIMasker().placeholder_for(item) if self._action_for(item, result.decision) == "mask_and_allow" else None,
                }
                for item in result.findings
            ],
            "masked_preview": result.sanitized_text,
            "external_egress_allowed": result.decision.external_egress_allowed,
            "policy_ids": result.decision.policy_ids,
        }

    def scan_response_text(self, project_id: str, text: str, action: str = "mask") -> ResponseScanResult:
        settings = get_settings()
        if not settings.pii_response_scan_enabled or not text:
            return ResponseScanResult(text, [], 0, "allow")
        if len(text) > settings.pii_max_text_characters:
            raise request_too_large("Provider response exceeds the privacy scanning limit.")
        findings = self.detector.detect(text)
        if not findings:
            return ResponseScanResult(text, [], 0, "allow")
        if action == "block":
            raise pii_policy_blocked("The provider response was blocked by the configured privacy policy.", code="response_privacy_blocked")
        masked = PIIMasker().mask(text, findings)
        return ResponseScanResult(masked.text, findings, masked.masked_count, "mask")

    def _action_for(self, finding: PIIFinding, decision: Any) -> str:
        for entity in decision.entity_decisions:
            if entity.entity_type == finding.entity_type and abs(entity.confidence - finding.confidence) < 0.0001:
                return entity.action
        return decision.action
