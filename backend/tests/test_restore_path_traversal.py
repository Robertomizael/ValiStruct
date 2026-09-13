import io
import zipfile
import pytest

pytest.importorskip("flask")
import api

def _zip_bytes(entries):
    bio=io.BytesIO()
    with zipfile.ZipFile(bio,"w",zipfile.ZIP_DEFLATED) as z:
        for name,content in entries:
            z.writestr(name,content)
    bio.seek(0)
    return bio

def test_restore_rejects_path_traversal(monkeypatch, tmp_path):
    monkeypatch.setattr(api,"PROJECT_DIR",tmp_path/"projects")
    api.PROJECT_DIR.mkdir(parents=True,exist_ok=True)
    monkeypatch.setattr(api,"AUTH_ENABLED",False)

    payload=_zip_bytes([
        ("../escape.txt","bad"),
        ("/absolute.txt","bad"),
        ("safe/project.json",'{"ok":true}')
    ])

    client=api.app.test_client()
    resp=client.post("/admin/restore",data={"file":(payload,"backup.zip")},
                     content_type="multipart/form-data")
    # AUTH disabled => local admin semantics are allowed by _require_auth.
    assert resp.status_code in (200,403)
    assert not (tmp_path/"escape.txt").exists()
    assert not (tmp_path/"absolute.txt").exists()
