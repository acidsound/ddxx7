#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aggregate FM validation results into summary/issues/fix plan")
    parser.add_argument(
        "--analysis-manifest",
        default="validation/out/analysis/manifest.json",
        help="Path to analysis manifest from run_audio_ear.mjs",
    )
    parser.add_argument(
        "--audit-json",
        default="validation/out/audit/audit.json",
        help="Path to audit report JSON",
    )
    parser.add_argument(
        "--reports-root",
        default="validation/reports",
        help="Output root directory for timestamped reports",
    )
    return parser.parse_args()


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def as_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return v


def is_non_finite_number(value: Any) -> bool:
    try:
        return not math.isfinite(float(value))
    except Exception:
        return False


def severity_rank(severity: str) -> int:
    return {"P0": 0, "P1": 1, "P2": 2}.get(severity, 99)


def make_issue(
    issue_id: str,
    severity: str,
    title: str,
    evidence: str,
    target_files: List[str],
    remediation: str,
    case_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "id": issue_id,
        "severity": severity,
        "title": title,
        "caseId": case_id,
        "evidence": evidence,
        "targetFiles": target_files,
        "remediation": remediation,
        "details": details or {},
    }


def main() -> int:
    args = parse_args()
    analysis = load_json(args.analysis_manifest)
    audit = load_json(args.audit_json) if os.path.exists(args.audit_json) else {}

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    file_dx7 = os.path.join(repo_root, "public", "dx7-processor.js")
    file_alg = os.path.join(repo_root, "services", "algorithms.ts")
    file_sysex = os.path.join(repo_root, "services", "sysex.ts")

    p0_threshold_f0_cents = 15.0
    p1_threshold_centroid_hz = 250.0
    p1_threshold_decay_t40 = 0.06
    p1_threshold_ring = 0.15

    cases: List[Dict[str, Any]] = analysis.get("cases", [])
    total_cases = len(cases)
    issues: List[Dict[str, Any]] = []
    suggestion_counter: Counter[str] = Counter()

    for case in cases:
        case_id = case.get("id")
        diff = case.get("difference", {})
        non_finite_ref = int(case.get("nonFiniteSamples", {}).get("reference", 0) or 0)
        non_finite_test = int(case.get("nonFiniteSamples", {}).get("test", 0) or 0)
        non_finite_total = non_finite_ref + non_finite_test

        f0_delta = diff.get("median_f0_delta_cents")
        centroid_delta = as_float(diff.get("centroid_delta_hz"))
        decay_t40_delta = as_float(diff.get("low_decay_t40_delta_seconds"))
        ring_delta = as_float(diff.get("ring_ratio_delta"))

        if non_finite_total > 0 or is_non_finite_number(f0_delta):
            issues.append(
                make_issue(
                    issue_id=f"{case_id}:p0_non_finite_or_invalid_f0",
                    severity="P0",
                    title="Non-finite sample or invalid F0 delta detected",
                    case_id=case_id,
                    evidence=f"nonFiniteSamples={non_finite_total}, median_f0_delta_cents={f0_delta}",
                    target_files=[file_dx7, file_sysex],
                    remediation="core_pitch_and_stability",
                )
            )
        else:
            f0_delta_v = as_float(f0_delta)
            if f0_delta_v is not None and abs(f0_delta_v) > p0_threshold_f0_cents:
                issues.append(
                    make_issue(
                        issue_id=f"{case_id}:p0_pitch_mismatch",
                        severity="P0",
                        title="Pitch delta exceeds threshold",
                        case_id=case_id,
                        evidence=f"|median_f0_delta_cents|={abs(f0_delta_v):.2f} > {p0_threshold_f0_cents:.2f}",
                        target_files=[file_dx7, file_sysex],
                        remediation="core_pitch_and_stability",
                        details={"median_f0_delta_cents": f0_delta_v},
                    )
                )

        p1_hits = []
        if centroid_delta is not None and abs(centroid_delta) > p1_threshold_centroid_hz:
            p1_hits.append(f"|centroid_delta_hz|={abs(centroid_delta):.2f}")
        if decay_t40_delta is not None and abs(decay_t40_delta) > p1_threshold_decay_t40:
            p1_hits.append(f"|low_decay_t40_delta_seconds|={abs(decay_t40_delta):.4f}")
        if ring_delta is not None and abs(ring_delta) > p1_threshold_ring:
            p1_hits.append(f"|ring_ratio_delta|={abs(ring_delta):.4f}")

        if p1_hits:
            issues.append(
                make_issue(
                    issue_id=f"{case_id}:p1_timbre_envelope_gap",
                    severity="P1",
                    title="Timbre/envelope delta exceeds threshold",
                    case_id=case_id,
                    evidence=", ".join(p1_hits),
                    target_files=[file_dx7],
                    remediation="timbre_envelope_alignment",
                    details={
                        "centroid_delta_hz": centroid_delta,
                        "low_decay_t40_delta_seconds": decay_t40_delta,
                        "ring_ratio_delta": ring_delta,
                    },
                )
            )

        for focus in case.get("suggestionFocuses", []):
            if isinstance(focus, str) and focus and focus != "요약":
                suggestion_counter[focus] += 1

    repeated_threshold = math.ceil(max(1, total_cases) * 0.2)
    for focus, count in sorted(suggestion_counter.items(), key=lambda kv: (-kv[1], kv[0])):
        if count >= repeated_threshold:
            issues.append(
                make_issue(
                    issue_id=f"global:p2_repeated_focus:{focus}",
                    severity="P2",
                    title=f"Repeated suggestion focus: {focus}",
                    evidence=f"{count}/{total_cases} cases (threshold={repeated_threshold})",
                    target_files=[file_dx7],
                    remediation="systematic_tone_gap",
                    details={"focus": focus, "count": count, "threshold": repeated_threshold},
                )
            )

    algorithm_audit = audit.get("algorithmAudit", {})
    invalid_entries = algorithm_audit.get("invalidEntries", []) if isinstance(algorithm_audit, dict) else []
    invalid_indices = algorithm_audit.get("invalidIndices", []) if isinstance(algorithm_audit, dict) else []
    if invalid_entries or invalid_indices:
        issues.append(
            make_issue(
                issue_id="global:p0_algorithm_integrity",
                severity="P0",
                title="Algorithm graph integrity issue detected",
                evidence=f"invalidEntries={len(invalid_entries)}, invalidIndices={len(invalid_indices)}",
                target_files=[file_alg],
                remediation="algorithm_integrity",
                details={"invalidEntries": invalid_entries, "invalidIndices": invalid_indices},
            )
        )

    for deviation in audit.get("deviations", []):
        deviation_id = str(deviation.get("id", "unknown_deviation"))
        if deviation_id == "reference_repo_missing":
            continue
        issues.append(
            make_issue(
                issue_id=f"global:p1_audit_deviation:{deviation_id}",
                severity="P1",
                title=f"Static audit deviation: {deviation_id}",
                evidence=str(deviation.get("impact", "")),
                target_files=[file_dx7],
                remediation="reference_alignment",
                details=deviation,
            )
        )

    issues.sort(key=lambda item: (severity_rank(item["severity"]), item["id"]))

    severity_counts = {"P0": 0, "P1": 0, "P2": 0}
    for issue in issues:
        sev = issue["severity"]
        if sev in severity_counts:
            severity_counts[sev] += 1

    report_payload = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "totalCases": total_cases,
        "thresholds": {
            "P0": {"median_f0_delta_cents_abs_gt": p0_threshold_f0_cents, "or_non_finite": True},
            "P1": {
                "centroid_delta_hz_abs_gt": p1_threshold_centroid_hz,
                "low_decay_t40_delta_seconds_abs_gt": p1_threshold_decay_t40,
                "ring_ratio_delta_abs_gt": p1_threshold_ring,
            },
            "P2": {"repeated_focus_case_ratio_gte": 0.2, "repeated_focus_case_count_gte": repeated_threshold},
        },
        "severityCounts": severity_counts,
        "issues": issues,
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_dir = os.path.join(args.reports_root, timestamp)
    os.makedirs(report_dir, exist_ok=True)

    issues_path = os.path.join(report_dir, "issues.json")
    with open(issues_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, ensure_ascii=False, indent=2)

    summary_lines = [
        "# DDXX7 FM Validation Summary",
        "",
        f"- Generated: {report_payload['generatedAt']}",
        f"- Total cases: {total_cases}",
        f"- P0: {severity_counts['P0']}",
        f"- P1: {severity_counts['P1']}",
        f"- P2: {severity_counts['P2']}",
        "",
        "## Top Findings",
        "",
    ]
    if not issues:
        summary_lines.append("- No issues detected by current thresholds.")
    else:
        for idx, issue in enumerate(issues[:20], start=1):
            scope = f" (case: {issue['caseId']})" if issue.get("caseId") else ""
            summary_lines.append(
                f"{idx}. [{issue['severity']}] {issue['title']}{scope} - {issue['evidence']}"
            )
    summary_lines.append("")

    summary_path = os.path.join(report_dir, "summary.md")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("\n".join(summary_lines) + "\n")

    remediation_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for issue in issues:
        remediation_groups[issue.get("remediation", "misc")].append(issue)

    remediation_templates = {
        "core_pitch_and_stability": {
            "title": "Core Pitch and Stability",
            "why": "F0 mismatch or non-finite output indicates synthesis core inconsistency.",
            "actions": [
                "Verify oscillator frequency path (ratio/fixed mode, detune mapping, transpose handling).",
                "Add clamping/guard for invalid modulation accumulation before sine stage.",
                "Re-check SysEx field mapping that feeds pitch-sensitive parameters.",
            ],
            "targets": [file_dx7, file_sysex],
        },
        "timbre_envelope_alignment": {
            "title": "Timbre and Envelope Alignment",
            "why": "Centroid/decay/ring deltas indicate envelope/filter dynamic mismatch.",
            "actions": [
                "Tune envelope increment/divisor and release progression to match reference contour.",
                "Inspect amplitude modulation depth and feedback path interaction for ring/brightness drift.",
                "Re-run targeted release cases after each parameter update.",
            ],
            "targets": [file_dx7],
        },
        "reference_alignment": {
            "title": "Reference Formula Alignment",
            "why": "Static audit found intentional or accidental formula-level deviations.",
            "actions": [
                "Decide which deviations are intentional product choices vs. compatibility regressions.",
                "If aiming for closer reference match, align envelope divisor and key rate scaling semantics.",
                "Document final decisions in validation/audit report for future regression reviews.",
            ],
            "targets": [file_dx7],
        },
        "algorithm_integrity": {
            "title": "Algorithm Integrity",
            "why": "Algorithm graph inconsistencies can invalidate modulation topology.",
            "actions": [
                "Fix invalid operator indices and modulation matrix row constraints.",
                "Add static integrity checks as CI gate for algorithms.ts changes.",
            ],
            "targets": [file_alg],
        },
        "systematic_tone_gap": {
            "title": "Systematic Tone Gap",
            "why": "Repeated suggestion focus across many cases indicates broad tonal drift.",
            "actions": [
                "Prioritize a single global correction that addresses repeated focus before per-case tweaks.",
                "Use the repeated focus list as acceptance target for next validation run.",
            ],
            "targets": [file_dx7],
        },
    }

    fix_plan_lines = [
        "# DDXX7 FM Fix Plan",
        "",
        f"- Source report: `{issues_path}`",
        f"- Total tracked issues: {len(issues)}",
        "",
    ]

    if not issues:
        fix_plan_lines.append("No fixes scheduled because no issues crossed thresholds.")
    else:
        order = [
            "core_pitch_and_stability",
            "algorithm_integrity",
            "timbre_envelope_alignment",
            "reference_alignment",
            "systematic_tone_gap",
        ]
        section_idx = 1
        for key in order:
            group = remediation_groups.get(key, [])
            if not group:
                continue
            tpl = remediation_templates[key]
            fix_plan_lines.append(f"{section_idx}. {tpl['title']}")
            fix_plan_lines.append(f"   - Why: {tpl['why']}")
            fix_plan_lines.append(
                f"   - Scope: {len(group)} issues ({', '.join(sorted({x['severity'] for x in group}))})"
            )
            fix_plan_lines.append(f"   - Target files: {', '.join(tpl['targets'])}")
            for action in tpl["actions"]:
                fix_plan_lines.append(f"   - Action: {action}")
            section_idx += 1

    fix_plan_lines.append("")
    fix_plan_path = os.path.join(report_dir, "fix_plan.md")
    with open(fix_plan_path, "w", encoding="utf-8") as f:
        f.write("\n".join(fix_plan_lines) + "\n")

    print(f"summary: {summary_path}")
    print(f"issues: {issues_path}")
    print(f"fix_plan: {fix_plan_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

