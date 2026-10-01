import io
import sys
from pathlib import Path
import pandas as pd
import pyreadstat
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import api

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VALISTRUCT_INSTITUTIONAL_MODE","false")
    api.app.config["TESTING"]=True
    return api.app.test_client()

@pytest.mark.parametrize("suffix,writer,expected",[
    (".sav",pyreadstat.write_sav,"SPSS SAV"),
    (".dta",pyreadstat.write_dta,"Stata DTA"),
])
def test_legacy_conversion_is_available_in_scientific_mode(tmp_path,client,suffix,writer,expected):
    df=pd.DataFrame({
        "ID":[1,2,3],
        "i01":[1.0,2.0,3.0],
        "i02":[2.0,None,4.0],
    })
    path=tmp_path/("participants"+suffix)
    writer(df,str(path))
    response=client.post(
        "/legacy-to-csv",
        data={"file":(io.BytesIO(path.read_bytes()),path.name)},
        content_type="multipart/form-data",
    )
    assert response.status_code==200,response.get_data(as_text=True)
    data=response.get_json()
    assert data["ok"] is True
    assert data["rows"]==3 and data["columns"]==3
    assert data["meta"]["format"]==expected
    assert "ID" in data["csv_text"] and "i02" in data["csv_text"]
