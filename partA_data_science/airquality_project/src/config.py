"""Central configuration: paths, column names, split sizes and the random seed.

Everything that a reader might want to change lives here, so the other modules
contain no "magic numbers".
"""
from pathlib import Path

# ---- paths (relative to the project root, so the code runs from any folder) ----
ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = ROOT / "data" / "raw" / "AirQualityUCI.csv"
PROCESSED_DIR = ROOT / "data" / "processed"
FIG_DIR = ROOT / "outputs" / "figures"
TABLE_DIR = ROOT / "outputs" / "tables"
RESULTS_JSON = ROOT / "outputs" / "results.json"

# ---- reproducibility ----
SEED = 42

# ---- data description ----
MISSING_CODE = -200                       # UCI documents -200 as the "missing" tag
TARGET = "CO(GT)"                         # reference-analyser CO, mg/m^3
SENSOR_COLS = ["PT08.S1(CO)", "PT08.S2(NMHC)", "PT08.S3(NOx)",
               "PT08.S4(NO2)", "PT08.S5(O3)"]   # low-cost metal-oxide sensors
WEATHER_COLS = ["T", "RH", "AH"]          # temperature, relative & absolute humidity
REFERENCE_COLS = ["CO(GT)", "NMHC(GT)", "C6H6(GT)", "NOx(GT)", "NO2(GT)"]  # reference analyser
BASE_FEATURES = SENSOR_COLS + WEATHER_COLS
SIMPLE_FEATURE = ["PT08.S1(CO)"]          # the sensor nominally targeted at CO

# ---- chronological split (fractions of the rows that survive cleaning) ----
TRAIN_FRAC = 0.60
VAL_FRAC = 0.20                           # the remaining 20 % is the test set

# ---- cross-validation / tuning ----
CV_SPLITS = 5
CV_GAP_HOURS = 24                         # TimeSeriesSplit gap = 24 retained observations (rows) between CV train and
                                          # validation folds; rows are hourly but ~20 % of hours were dropped, so this is not exactly 24 clock hours
POLY_DEGREES = [1, 2, 3]
RIDGE_ALPHAS = [0.01, 0.1, 1, 10, 100, 1000]

# ---- monthly drift diagnostic ----
MIN_TRAIN_ROWS_DRIFT = 1000
MIN_TEST_ROWS_DRIFT = 50
