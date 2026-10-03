"""Fase 6: candidate manifest must track the audited v5.4 beta rebuild."""
# Metadata validation trigger for audited candidate.
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]


def test_candidate_manifest_matches_audited_v54_beta_and_preserves_nonpublication():
    version=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
    manifest=json.loads((ROOT/"release/candidate-v5.4-beta1.json").read_text(encoding="utf-8"))

    assert manifest["version"]==version["version"]=="5.4.0-beta.1"
    assert manifest["displayVersion"]==version["displayVersion"]=="5.4 Beta"
    assert manifest["projectFormat"]==version["projectFormat"]=="3.0"

    audited_head="4c0d64299c34fb39f7b1ffbe8c61a4a668ad4e3b"
    assert manifest["sourceBranch"]=="fix/v5-4-fase6-auditoria-independiente"
    assert manifest["sourceCommit"]==audited_head
    assert manifest["validatedHead"]==audited_head
    assert manifest["workflowRunId"]==37161435623
    assert manifest["published"] is False
    assert manifest["mergedToMain"] is False
    assert manifest["valid"] is True
    assert manifest["status"]=="validated-fase6-audited-rebuild"

    artifacts=manifest["artifacts"]
    assert len(artifacts)==3
    expected={
        ("macOS","arm64","valistruct-desktop-macos-arm64-autonomous"): (11288265743,593925689),
        ("macOS","x64","valistruct-desktop-macos-intel-autonomous"): (11288191001,619205761),
        ("Windows","x64","valistruct-desktop-windows-autonomous"): (11287114318,803250687),
    }
    expected_sha256={
        "valistruct-desktop-macos-arm64-autonomous":"d1f67cbf3c9d588d59c685d0be0d757a01845c1c2b7f971fa5e8d2428df4bb1b",
        "valistruct-desktop-macos-intel-autonomous":"d08209c32fd34b21a15662bfc91ec8499a4e3ca3ca17a2450d90d5a405421336",
        "valistruct-desktop-windows-autonomous":"4944d994964fb6426899e9915ee3826ea50cbe74b4cee9fc7a54c9d6bf43fc06",
    }
    assert {(a["platform"],a["architecture"],a["name"]) for a in artifacts}==set(expected)
    for artifact in artifacts:
        key=(artifact["platform"],artifact["architecture"],artifact["name"])
        artifact_id,size=expected[key]
        assert artifact["artifactId"]==artifact_id
        assert artifact["sizeInBytes"]==size
        assert re.fullmatch(r"[0-9a-f]{64}",artifact["archiveSha256"])
        assert artifact["archiveSha256"]==expected_sha256[artifact["name"]]
        assert artifact["expiresAt"].endswith("Z")
