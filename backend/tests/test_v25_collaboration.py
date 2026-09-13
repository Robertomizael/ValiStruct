def test_v25_helpers_exist():
    import api
    assert hasattr(api, "_log_activity")
    assert hasattr(api, "_notify")
    assert hasattr(api, "_project_collaborators")
