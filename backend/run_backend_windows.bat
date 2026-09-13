@echo off
python -m pip install -r requirements.txt
Rscript install_R_packages.R
python api.py
pause
