def test_v30_rc_endpoints_exist():
    import api
    for name in ["version_info","rc_check","security_status"]:
        assert hasattr(api,name)
