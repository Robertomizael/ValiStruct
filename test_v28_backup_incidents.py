def test_v28_endpoints_exist():
    import api
    for name in ["admin_backup","admin_restore","list_incidents","create_incident","toggle_incident"]:
        assert hasattr(api,name)
