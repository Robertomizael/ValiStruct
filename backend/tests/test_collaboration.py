import os, json, tempfile, hashlib, importlib, sys
from pathlib import Path
import pytest

def test_permission_helpers_exist():
    import api
    assert hasattr(api, "_can_read_project")
    assert hasattr(api, "_can_edit_project")
    assert hasattr(api, "_save_version")
