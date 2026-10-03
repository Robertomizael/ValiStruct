import os
import tempfile

import pandas as pd
import pyreadstat

os.environ.setdefault("VALISTRUCT_AUTH_ENABLED","false")
os.environ.setdefault("VALISTRUCT_INSTITUTIONAL_MODE","true")
os.environ.setdefault("VALISTRUCT_PROJECT_LIBRARY_ENABLED","false")

import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import api


def test_legacy_sav_preserves_variable_and_value_labels():
    api.app.config["TESTING"] = True
    client=api.app.test_client()

    df=pd.DataFrame({
        "ID":[1,2,3],
        "sexo":[1,2,1],
        "nivel":[1,2,2],
    })

    with tempfile.NamedTemporaryFile(suffix=".sav",delete=False) as tmp:
        path=tmp.name

    try:
        pyreadstat.write_sav(
            df,
            path,
            column_labels={
                "sexo":"Sexo de la persona",
                "nivel":"Nivel de riesgo"
            },
            variable_value_labels={
                "sexo":{1:"Mujer",2:"Hombre"},
                "nivel":{1:"Bajo",2:"Alto"},
            },
        )
        with open(path,"rb") as fh:
            response=client.post(
                "/legacy-to-csv",
                data={"file":(fh,"demo.sav")},
                content_type="multipart/form-data",
            )

        assert response.status_code==200
        data=response.get_json()
        assert data["ok"] is True
        assert data["meta"]["format"]=="SPSS SAV"
        assert data["meta"]["labels"]["sexo"]=="Sexo de la persona"
        assert data["meta"]["labels"]["nivel"]=="Nivel de riesgo"
        assert data["meta"]["value_labels"]["sexo"]["1"]=="Mujer"
        assert data["meta"]["value_labels"]["sexo"]["2"]=="Hombre"
        assert data["meta"]["value_labels"]["nivel"]["1"]=="Bajo"
        assert data["meta"]["value_labels"]["nivel"]["2"]=="Alto"

        # Raw analytical codes stay numeric; labels are metadata only.
        csv_text=data["csv_text"]
        assert "Mujer" not in csv_text
        assert "Hombre" not in csv_text
        assert "1.0" in csv_text or ",1," in csv_text
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def test_legacy_dta_preserves_variable_and_value_labels():
    api.app.config["TESTING"] = True
    client=api.app.test_client()

    df=pd.DataFrame({
        "ID":[1,2,3],
        "sexo":[1,2,1],
        "nivel":[1,2,2],
    })

    with tempfile.NamedTemporaryFile(suffix=".dta",delete=False) as tmp:
        path=tmp.name

    try:
        pyreadstat.write_dta(
            df,
            path,
            column_labels={
                "sexo":"Sexo de la persona",
                "nivel":"Nivel de riesgo"
            },
            variable_value_labels={
                "sexo":{1:"Mujer",2:"Hombre"},
                "nivel":{1:"Bajo",2:"Alto"},
            },
        )
        with open(path,"rb") as fh:
            response=client.post(
                "/legacy-to-csv",
                data={"file":(fh,"demo.dta")},
                content_type="multipart/form-data",
            )

        assert response.status_code==200
        data=response.get_json()
        assert data["ok"] is True
        assert data["meta"]["format"]=="Stata DTA"
        assert data["meta"]["labels"]["sexo"]=="Sexo de la persona"
        assert data["meta"]["labels"]["nivel"]=="Nivel de riesgo"
        assert data["meta"]["value_labels"]["sexo"]["1"]=="Mujer"
        assert data["meta"]["value_labels"]["sexo"]["2"]=="Hombre"
        assert data["meta"]["value_labels"]["nivel"]["1"]=="Bajo"
        assert data["meta"]["value_labels"]["nivel"]["2"]=="Alto"

        csv_text=data["csv_text"]
        assert "Mujer" not in csv_text
        assert "Hombre" not in csv_text
        assert ",1," in csv_text or "1.0" in csv_text
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
