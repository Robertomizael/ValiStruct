def test_v26_helpers_exist():
    import api
    assert hasattr(api, "list_project_tasks")
    assert hasattr(api, "set_review_status")
    assert hasattr(api, "collaboration_docx")
    assert hasattr(api, "telemetry")
