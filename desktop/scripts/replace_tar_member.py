"""Replace one regular-file member inside a .tar.gz archive deterministically.

Used only by the Windows desktop build hotfix. conda-pack can reconstruct
conda-managed files from package metadata, so a locally rebuilt quadprog.dll may
be replaced by the original packaged DLL during archive creation. This helper
rewrites exactly one archive member with the validated rebuilt DLL while
preserving all other tar metadata and members.
"""
from __future__ import annotations

import argparse
import io
import os
import tarfile
import tempfile


def norm(name: str) -> str:
    """Normalize tar member names for Windows semantics.

    Tar paths always use '/', but conda-pack may preserve directory casing
    differently (for example Lib/R vs lib/R). Windows treats those paths as the
    same, so matching here must be separator-normalized and case-insensitive.
    """
    name = name.replace("\\", "/")
    while name.startswith("./"):
        name = name[2:]
    return name.lstrip("/").casefold()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("archive")
    ap.add_argument("replacement")
    ap.add_argument("member")
    args = ap.parse_args()

    archive = os.path.abspath(args.archive)
    replacement = os.path.abspath(args.replacement)
    target = norm(args.member)

    if not os.path.isfile(archive):
        raise SystemExit(f"archive not found: {archive}")
    if not os.path.isfile(replacement):
        raise SystemExit(f"replacement not found: {replacement}")

    with open(replacement, "rb") as fh:
        replacement_bytes = fh.read()

    fd, tmp = tempfile.mkstemp(prefix="valistruct-runtime-", suffix=".tar.gz", dir=os.path.dirname(archive))
    os.close(fd)
    replaced = 0
    actual_matches: list[str] = []
    try:
        with tarfile.open(archive, "r:gz") as src, tarfile.open(tmp, "w:gz", format=tarfile.PAX_FORMAT) as dst:
            for member in src:
                if norm(member.name) == target:
                    if not member.isfile():
                        raise SystemExit(f"target member is not a regular file: {member.name}")
                    actual_matches.append(member.name)
                    member.size = len(replacement_bytes)
                    dst.addfile(member, io.BytesIO(replacement_bytes))
                    replaced += 1
                    continue

                fileobj = src.extractfile(member) if member.isfile() else None
                dst.addfile(member, fileobj)

        if replaced != 1:
            raise SystemExit(
                f"expected to replace exactly 1 member '{args.member}' (normalized '{target}'), "
                f"replaced {replaced}; matches={actual_matches}"
            )

        os.replace(tmp, archive)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)

    print(
        f"Archive member replaced: {actual_matches[0]} -> {args.member} "
        f"({len(replacement_bytes)} bytes)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
