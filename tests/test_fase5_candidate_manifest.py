"""Fase 5: candidate manifest must remain tied to the validated v5.4 beta build."""
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]


def test_candidate_manifest_matches_v54_beta_and_preserves_nonpublication():
    version=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
    manifest=json.loads((ROOT/"release/candidate-v5.4-beta1.json").read_text(encoding="utf-8"))

    assert manifest["version"]==version["version"]=="5.4.0-beta.1"
    assert manifest["displayVersion"]==version["displayVersion"]=="5.4 Beta"
    assert manifest["projectFormat"]==version["projectFormat"]=="3.0"

    assert manifest["sourceCommit"]=="538bca5d553e7df9f0b6e02514a483448d207239"
    assert manifest["validatedHead"]=="b4a450365727d86c8dc9b404b04d9112cceb10ee"
    assert manifest["workflowRunId"]==37145587046
    assert manifest["published"] is False
    assert manifest["mergedToMain"] is False
    assert manifest["valid"] is False
    assert manifest["status"]=="invalidated-by-fase6-audit-pending-rebuild"

    artifacts=manifest["artifacts"]
    assert {a["platform"] for a in artifacts}=={"macOS","Windows"}
    assert {a["name"] for a in artifacts}=={
        "valistruct-desktop-macos-autonomous",
        "valistruct-desktop-windows-autonomous",
    }

    expected_sizes={"macOS":573004166,"Windows":779603487}
    expected_ids={"macOS":11281679660,"Windows":11281584970}
    for artifact in artifacts:
        assert artifact["artifactId"]==expected_ids[artifact["platform"]]
        assert artifact["sizeInBytes"]==expected_sizes[artifact["platform"]]
        assert re.fullmatch(r"[0-9a-f]{64}",artifact["archiveSha256"])
        assert artifact["expiresAt"].endswith("Z")
