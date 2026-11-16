# Can a low-cost gas-sensor array stand in for a reference CO analyser?

An end-to-end, reproducible data-science project (IIITDM Kancheepuram, *Introduction to Data Science for Engineers*).
It predicts the carbon-monoxide concentration measured by an expensive reference analyser from the hourly responses of
five cheap metal-oxide sensors plus temperature and humidity, and asks whether a model trained on the past still works on the future.

## Problem statement and research question
Reference air-quality analysers are costly; cheap sensors are not selective and are affected by weather. 
**Research question:** *Can reference CO (`CO(GT)`, mg/m³) be predicted from low-cost sensor responses plus temperature and humidity, and how well does a model trained on earlier months perform on later months?*

This is a **prediction** question. Nothing here claims that a sensor, temperature or humidity *causes* a change in CO.

**Measurable objectives**
1. Audit the raw data and justify every cleaning decision.
2. Compare a baseline and at least two modelling approaches on a time-ordered split (train / validation / test) without leakage.
3. Report MAE, RMSE and R² for every model and compare them with the baseline.
4. Analyse where and when the best model fails, and state the limitations.

## Dataset
*Air Quality*, UCI Machine Learning Repository - https://archive.ics.uci.edu/dataset/360/air+quality  
Citation: Vito, S. (2008). *Air Quality* [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C59K5F · licence CC BY 4.0 (the UCI page also states it is for research use).  
Original paper: De Vito et al. (2008), *On field calibration of an electronic nose for benzene estimation in an urban pollution monitoring scenario*, Sensors and Actuators B.  
Hourly averages from a multisensor device placed at road level in an Italian city, with ground truth from a co-located certified analyser.
The raw file is included in `data/raw/AirQualityUCI.csv`.
In the file I inspected: 9,357 hourly rows from 2004-03-10 to 2005-04-04 after removing 114 blank rows and 2 empty columns (UCI's page says 9,358 rows and ends in February 2005; this file differs - see report).

## Folder structure
```
airquality_project/
├── data/raw/AirQualityUCI.csv     original file (unchanged)
├── data/processed/                cleaned modelling table (regenerated, git-ignored)
├── src/                           config.py · data.py · features.py · models.py · evaluate.py · plotting.py · run_pipeline.py
├── notebooks/walkthrough.ipynb    step-by-step demo (already executed)
├── tests/test_pipeline.py         leakage / cleaning / determinism checks
├── outputs/figures/               all figures (PNG)
├── outputs/tables/                all result tables (CSV)
├── outputs/results.json           every number used in the report
├── requirements.txt · requirements-dev.txt · .gitignore · README.md
```

## Installation
```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt                          # add requirements-dev.txt for notebook + tests
```
Tested with Python 3.13.18, pandas 3.0.5, NumPy 2.5.3, scikit-learn 1.9.1, SciPy 1.18.1.

**Required libraries:** NumPy, pandas, SciPy, scikit-learn, Matplotlib (versions pinned in `requirements.txt`).

## How to run
```bash
python -m src.run_pipeline        # whole analysis, ~5 s: tables, figures, outputs/results.json
python -m pytest -q               # 7 checks (needs requirements-dev.txt)
jupyter lab notebooks/walkthrough.ipynb   # optional guided walk-through
```
Run all commands from the project root. The random seed is fixed in `src/config.py` (`SEED = 42`); the models themselves are deterministic, so repeated runs give identical numbers.

## Analysis workflow
1. **Load and audit** - fix the file structure, convert `-200` to missing, check duplicates, time gaps, ranges, stuck sensors.
2. **Clean** - drop `NMHC(GT)` (90 % missing); drop the 366 outage hours (all inputs missing) and 1,647 further hours with no CO reference; keep outliers; no mean-imputation. 7,344 rows remain.
3. **Features** - hour of day (sin/cos), weekend flag. Reference-analyser columns are never used as inputs.
4. **Split by time** - train 4,406 rows (2004-03-10 to 2004-11-15), validation 1,469 (2004-11-15 to 2005-01-28), test 1,469 (2005-01-28 to 2005-04-04). The core EDA (distributions, hourly pattern, correlations, outliers, sensor-vs-target) uses train + validation only; three figures are explicitly full-dataset descriptive analyses that do not influence any modelling choice: missingness (`eda_01`), the monthly trend (`eda_06`) and the benzene validity check (`eda_08`).
5. **Models** - baseline (training mean); M1 simple linear regression on the CO sensor; M2 multiple linear regression; M3 = M2 + time features; M4 = M3 on log(1+CO); M5 polynomial + Ridge, tuned with 5-fold time-series cross-validation (gap of 24 retained observations between folds; because ~20 % of hours were removed this is not exactly 24 clock hours) on the training data. Scaling lives inside the pipelines, so it is fitted on training rows only.
6. **Select on validation, report on test once** - the chosen settings are refitted on train + validation and scored on the untouched test period.
7. **Error analysis and diagnostics** - errors by hour, CO level and humidity; worst days; month-by-month errors; random-vs-chronological split; bias test.

## Main findings (from this run; exact values in `outputs/results.json`)
| Model | Validation RMSE | Test RMSE | Test MAE | Test R² |
|---|---:|---:|---:|---:|
| Baseline: training mean | 1.785 | 1.320 | 1.068 | -0.030 |
| M1 Simple linear (S1 only) | 0.921 | 0.721 | 0.550 | 0.693 |
| M2 Multiple linear (8 inputs) | 0.794 | 0.484 | 0.344 | 0.862 |
| M3 Multiple linear (+time features) | 0.786 | 0.483 | 0.352 | 0.862 |
| M4 M3 on log(1+CO) | 0.828 | 0.451 | 0.284 | 0.880 |
| M5 Polynomial + Ridge (tuned) | 0.777 | 0.446 | 0.307 | 0.882 |

* Every model beats the naive baseline by a wide margin; most of the gain comes from using all sensors plus temperature/humidity (M1 → M2: test RMSE 0.721 → 0.484).
* Best on validation RMSE: **M5 Polynomial + Ridge (tuned)** (degree 2, alpha 100); but its validation lead over M2/M3 is small (0.777 vs 0.786/0.794), well inside the cross-validation fold-to-fold variation. M4 has the lowest MAE on both validation and test; the metric you pick changes the ranking.
* The time features add almost nothing (M3 vs M2 test RMSE 0.483 vs 0.484): the sensors already carry the daily traffic signal.
* Errors are larger for high CO: MAE 0.47 in the top CO quartile with a bias of -0.18 mg/m³ (peaks under-predicted). For the top-decile hours (n = 114), MAE 0.58, bias -0.41.
* Errors cluster in multi-day episodes: 5 of 65 test days have an average error beyond ±0.5 mg/m³, and the worst 5 days produce 36 % of the total squared error. Their cause is not identifiable from this data.
* Month-by-month (expanding window), error is highest in November-January (M3 MAE 0.55 / 0.49 / 0.44), when the training window contained no winter, and falls again later. There is **no steady upward trend**, so this data shows a seasonal-shift problem, not proven sensor drift.
* A random 80/20 split flatters M3 (R² 0.900) compared with a time-ordered split (R² 0.862).
* Mean test error of M5: +0.054 mg/m³. A naive z-test gives p = 2.8e-06, but hourly errors are strongly autocorrelated (lag-1 r = 0.72); with the effective sample size (≈ 243 instead of 1469) p = 0.057 and the 95 % interval is [-0.003, 0.111].
* **Why benzene is not the target:** `C6H6(GT)` is almost a deterministic function of one sensor (quadratic fit on `PT08.S2`, R² = 0.9999, RMSE 0.08 µg/m³), so it is not an independent reference measurement.

## Limitations
* One device, one site, about 13 months: no evidence the calibration transfers to other places, devices or years.
* The test period (Feb-Apr 2005) is short, and part of the validation-to-test improvement is explained by refitting on train + validation (which adds winter data) and by lower CO variability in the test period; one split cannot separate these effects.
* 1,647 hours with no CO reference were dropped; the missing hours are not random (they come in long blocks), so the results describe the hours where the reference worked.
* The reference CO is recorded to 0.1 mg/m³; a measurement-noise floor exists that no model can beat.
* Predictive association only; no causal claims. Unmeasured factors (traffic counts, wind, sensor age) are absent.
* Hourly data are autocorrelated, so naive confidence intervals are too narrow (shown above).

## What has and has not been verified
Verified by running: the full pipeline, the notebook and the 7 tests, in two environments - the original development environment (versions above) and a re-check on Python 3.12.3 / pandas 3.0.6 / NumPy 2.5.4 / scikit-learn 1.9.1 / SciPy 1.18.1 / Matplotlib 3.11.2 (all reported numbers identical). **Not verified:** other Python or library versions, Windows/macOS.

## Submission contents
The formal report (`Report_AirQuality_CO.docx` / `.pdf`) and the slides (`Presentation_AirQuality_CO.pptx`) sit next to this folder. Every number and figure in them comes from `outputs/results.json`, `outputs/tables/` and `outputs/figures/`.
