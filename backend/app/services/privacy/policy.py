from __future__ import annotations

from typing import Any

from app import store
from app.services.privacy.types import EntityDecision, PIIFinding, PrivacyAction, PrivacyDecision


ACTION_RANK: dict[str, int] = {"allow": 0, "mask_and_allow": 1, "block": 2}


def _project_policy(project_id: str) -> dict[str, Any] | None:
    project = next((item for item in store.PROJECTS if item["id"] == project_id), None)
    if not project:
        return None
    return next((item for item in store.POLICIES if item["id"] == project.get("policy_id")), None)


class PrivacyPolicyEvaluator:
    def evaluate(self, project_id: str, findings: list[PIIFinding]) -> PrivacyDecision:
        policy = _project_policy(project_id)
        if not policy or not policy.get("enabled", True):
            policy = {
                "id": "privacy-default-closed",
                "default_action": "block" if findings else "allow",
                "external_egress_allowed": False,
                "allow_external": False,
                "mask_before_external_egress": True,
                "mask_before_egress": True,
                "allow_restoration": False,
                "response_scan_enabled": True,
                "entity_rules": {},
            }
        default_action = policy.get("default_action", "allow")
        if default_action == "mask":
            default_action = "mask_and_allow"
        entity_rules = policy.get("entity_rules") or {}
        decisions: list[EntityDecision] = []
        final_action: PrivacyAction = "allow"
        for finding in findings:
            rule = entity_rules.get(finding.entity_type) or {}
            minimum = float(rule.get("minimum_confidence", 0.0))
            if finding.confidence < minimum:
                action: PrivacyAction = "allow"
            else:
                action = rule.get("action", default_action)
                if action == "mask":
                    action = "mask_and_allow"
            if ACTION_RANK[action] > ACTION_RANK[final_action]:
                final_action = action
            decisions.append(EntityDecision(finding.entity_type, finding.confidence, action))
        external_allowed = bool(policy.get("external_egress_allowed", policy.get("allow_external", True)))
        return PrivacyDecision(
            action=final_action,
            policy_ids=[policy["id"]],
            external_egress_allowed=external_allowed,
            mask_before_external_egress=bool(policy.get("mask_before_external_egress", policy.get("mask_before_egress", True))),
            allow_restoration=bool(policy.get("allow_restoration", False)),
            response_scan_enabled=bool(policy.get("response_scan_enabled", True)),
            entity_decisions=decisions,
        )
