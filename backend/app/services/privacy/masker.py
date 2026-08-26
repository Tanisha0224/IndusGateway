from __future__ import annotations

from collections import defaultdict

from app.services.privacy.types import MaskingResult, PIIFinding


class PIIMasker:
    def __init__(self) -> None:
        self._placeholders: dict[tuple[str, str], str] = {}
        self._counters: dict[str, int] = defaultdict(int)

    def placeholder_for(self, finding: PIIFinding) -> str:
        key = (finding.entity_type, finding.fingerprint)
        if key not in self._placeholders:
            self._counters[finding.entity_type] += 1
            self._placeholders[key] = f"[{finding.entity_type}_{self._counters[finding.entity_type]}]"
        return self._placeholders[key]

    @property
    def placeholder_count(self) -> int:
        return len(set(self._placeholders.values()))

    def mask(self, text: str, findings: list[PIIFinding]) -> MaskingResult:
        if not findings:
            return MaskingResult(text=text, placeholder_count=0, masked_count=0)
        result = text
        masked_count = 0
        for finding in sorted(findings, key=lambda item: item.start):
            self.placeholder_for(finding)
        for finding in sorted(findings, key=lambda item: item.start, reverse=True):
            placeholder = self.placeholder_for(finding)
            result = result[:finding.start] + placeholder + result[finding.end:]
            masked_count += 1
        return MaskingResult(text=result, placeholder_count=self.placeholder_count, masked_count=masked_count)
