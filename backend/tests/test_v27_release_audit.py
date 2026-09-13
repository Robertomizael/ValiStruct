def test_v27_endpoints_exist():
    import api
    for name in ["set_task_status","add_approval","create_release","audit_summary","audit_package","monitor"]:
        assert hasattr(api,name)
