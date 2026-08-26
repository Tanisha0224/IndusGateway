from __future__ import annotations

import hashlib
import ipaddress
import math
import re
from collections.abc import Iterable

from app.services.privacy.types import PIIFinding


DETECTOR_VERSION = "deterministic-india-v1"


def _fingerprint(value: str) -> str:
    normalized = re.sub(r"\s+", "", value.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def _entropy(value: str) -> float:
    if not value:
        return 0.0
    counts = {char: value.count(char) for char in set(value)}
    return -sum((count / len(value)) * math.log2(count / len(value)) for count in counts.values())


def _luhn_valid(value: str) -> bool:
    digits = [int(char) for char in _digits(value)]
    if len(digits) < 12:
        return False
    checksum = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def _verhoeff_valid(value: str) -> bool:
    digits = _digits(value)
    if len(digits) != 12 or digits[0] in {"0", "1"}:
        return False
    check = 0
    for index, char in enumerate(reversed(digits)):
        check = _VERHOEFF_D[check][_VERHOEFF_P[index % 8][int(char)]]
    return check == 0


def _gstin_checksum_valid(value: str) -> bool:
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    body = value[:14].upper()
    factor = 2
    total = 0
    for char in reversed(body):
        code = chars.index(char)
        addend = factor * code
        factor = 1 if factor == 2 else 2
        addend = (addend // 36) + (addend % 36)
        total += addend
    check = (36 - (total % 36)) % 36
    return chars[check] == value[14].upper()


class PIIDetector:
    patterns = {
        "EMAIL": re.compile(r"(?<![\w.+-])[\w.+-]{1,64}@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(?![\w-])"),
        "INDIAN_MOBILE": re.compile(r"(?<!\d)(?:\+91[-\s]?|0)?[6-9]\d{9}(?!\d)"),
        "PAN": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", re.IGNORECASE),
        "AADHAAR": re.compile(r"(?<!\d)(?:[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4})(?!\d)"),
        "GSTIN": re.compile(r"\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", re.IGNORECASE),
        "CARD": re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"),
        "IFSC": re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b", re.IGNORECASE),
        "UPI": re.compile(r"(?<![\w.-])[\w.-]{2,64}@[A-Za-z]{2,32}(?![\w.-])"),
        "PASSPORT": re.compile(r"\b[A-Z][0-9]{7}\b", re.IGNORECASE),
        "JWT": re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b"),
        "API_KEY": re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|ig_sk_(?:live|test)_[A-Za-z0-9_]{12,}|[A-Za-z0-9_-]{32,})\b"),
        "BANK_ACCOUNT": re.compile(r"(?<!\d)\d{9,18}(?!\d)"),
    }

    context_terms = {
        "PAN": ("pan", "permanent account"),
        "BANK_ACCOUNT": ("account", "acct", "bank", "beneficiary", "ifsc"),
        "PASSPORT": ("passport", "travel document"),
        "API_KEY": ("api key", "secret", "token", "bearer", "credential", "password"),
    }

    def detect(self, text: str) -> list[PIIFinding]:
        if not text:
            return []
        findings: list[PIIFinding] = []
        for entity_type, pattern in self.patterns.items():
            for match in pattern.finditer(text):
                value = match.group(0)
                confidence = self._confidence(entity_type, value, text, match.start(), match.end())
                if confidence <= 0:
                    continue
                findings.append(
                    PIIFinding(
                        entity_type=entity_type,
                        start=match.start(),
                        end=match.end(),
                        confidence=confidence,
                        detector=f"deterministic_{entity_type.lower()}",
                        fingerprint=_fingerprint(value),
                        value=value,
                    )
                )
        findings.extend(self._ip_findings(text))
        return self._dedupe_overlaps(findings)

    def _confidence(self, entity_type: str, value: str, text: str, start: int, end: int) -> float:
        if entity_type == "EMAIL":
            return 0.9 if "." in value.rsplit("@", 1)[-1] else 0.0
        if entity_type == "INDIAN_MOBILE":
            digits = _digits(value)
            if digits.startswith("91") and len(digits) == 12:
                digits = digits[2:]
            if digits.startswith("0") and len(digits) == 11:
                digits = digits[1:]
            return 0.88 if len(digits) == 10 and digits[0] in "6789" else 0.0
        if entity_type == "PAN":
            return 0.98 if self._has_context(text, start, end, entity_type) else 0.86
        if entity_type == "AADHAAR":
            return 0.99 if _verhoeff_valid(value) else 0.0
        if entity_type == "GSTIN":
            value = value.upper()
            return 0.96 if _gstin_checksum_valid(value) else 0.88
        if entity_type == "CARD":
            digits = _digits(value)
            if len(digits) == 12:
                return 0.0
            return 0.97 if _luhn_valid(value) else 0.0
        if entity_type == "IFSC":
            return 0.94
        if entity_type == "UPI":
            domain = value.rsplit("@", 1)[-1]
            return 0.9 if len(domain) >= 2 and "." not in domain else 0.0
        if entity_type == "PASSPORT":
            return 0.9 if self._has_context(text, start, end, entity_type) else 0.72
        if entity_type == "JWT":
            return 0.98
        if entity_type == "API_KEY":
            if value.startswith(("sk-", "gsk_", "ig_sk_")):
                return 0.96
            return 0.9 if self._has_context(text, start, end, entity_type) and _entropy(value) >= 3.5 else 0.0
        if entity_type == "BANK_ACCOUNT":
            digits = _digits(value)
            if _luhn_valid(digits) or len(digits) == 12:
                return 0.0
            return 0.82 if self._has_context(text, start, end, entity_type) else 0.0
        return 0.0

    def _has_context(self, text: str, start: int, end: int, entity_type: str) -> bool:
        window = text[max(0, start - 36): min(len(text), end + 36)].lower()
        return any(term in window for term in self.context_terms.get(entity_type, ()))

    def _ip_findings(self, text: str) -> Iterable[PIIFinding]:
        pattern = re.compile(r"\b(?:[0-9a-fA-F:.]{3,45})\b")
        for match in pattern.finditer(text):
            value = match.group(0)
            if "." not in value and ":" not in value:
                continue
            try:
                ipaddress.ip_address(value)
            except ValueError:
                continue
            yield PIIFinding("IP_ADDRESS", match.start(), match.end(), 0.93, "deterministic_ip", _fingerprint(value), value)

    def _dedupe_overlaps(self, findings: list[PIIFinding]) -> list[PIIFinding]:
        priority = {
            "JWT": 100,
            "API_KEY": 95,
            "AADHAAR": 90,
            "CARD": 88,
            "GSTIN": 86,
            "PAN": 84,
            "IFSC": 82,
            "EMAIL": 81,
            "UPI": 80,
            "BANK_ACCOUNT": 72,
            "INDIAN_MOBILE": 70,
            "PASSPORT": 68,
            "IP_ADDRESS": 60,
        }
        ordered = sorted(findings, key=lambda item: (priority.get(item.entity_type, 0), item.confidence, item.end - item.start), reverse=True)
        accepted: list[PIIFinding] = []
        for finding in ordered:
            if any(not (finding.end <= current.start or finding.start >= current.end) for current in accepted):
                continue
            accepted.append(finding)
        return sorted(accepted, key=lambda item: (item.start, item.end))
