"""Loading, auditing and cleaning the UCI Air Quality data."""
import numpy as np
import pandas as pd

from . import config as C


def load_raw(path=C.RAW_CSV):
    """Read the CSV and fix its *structure* (no values are changed here).

    The file is semicolon-separated, uses decimal commas, has two empty trailing
    columns and a block of completely blank rows at the end.
    Returns the tidy frame and a small dict describing what was removed.
    """
    raw = pd.read_csv(path, sep=";", decimal=",")
    info = {"raw_rows": int(raw.shape[0]), "raw_cols": int(raw.shape[1])}

    unnamed = [c for c in raw.columns if str(c).startswith("Unnamed")]
    raw = raw.drop(columns=unnamed)
    blank = raw.isna().all(axis=1)                 # rows with no information at all
    df = raw.loc[~blank].copy()
    info.update(empty_columns_dropped=len(unnamed), blank_rows_dropped=int(blank.sum()),
                rows=int(df.shape[0]), cols=int(df.shape[1]))

    # Date is DD/MM/YYYY and Time is HH.MM.SS (dots, not colons)
    stamp = df["Date"] + " " + df["Time"].str.replace(".", ":", regex=False)
    df["datetime"] = pd.to_datetime(stamp, format="%d/%m/%Y %H:%M:%S")
    df = df.drop(columns=["Date", "Time"]).sort_values("datetime").reset_index(drop=True)
    return df, info


def numeric_columns(df):
    return [c for c in df.columns if c != "datetime"]


def longest_run(series):
    """Length of the longest run of identical consecutive values (NaNs ignored)."""
    s = series.dropna()
    if s.empty:
        return 0
    groups = (s != s.shift()).cumsum()
    return int(s.groupby(groups).size().max())


def audit(df_coded):
    """Data audit on the frame that still contains the -200 codes."""
    num = numeric_columns(df_coded)
    coded = (df_coded[num] == C.MISSING_CODE).sum()
    missing = pd.DataFrame({"n_missing": coded,
                            "pct_missing": (coded / len(df_coded) * 100).round(2)})
    clean = df_coded[num].replace(C.MISSING_CODE, np.nan)

    full_range = pd.date_range(df_coded["datetime"].min(), df_coded["datetime"].max(), freq="h")
    report = {
        "n_rows": int(len(df_coded)),
        "date_min": str(df_coded["datetime"].min()),
        "date_max": str(df_coded["datetime"].max()),
        "sorted_in_time": bool(df_coded["datetime"].is_monotonic_increasing),
        "duplicate_rows": int(df_coded.duplicated().sum()),
        "duplicate_timestamps": int(df_coded["datetime"].duplicated().sum()),
        "expected_hourly_timestamps": int(len(full_range)),
        "missing_timestamps": int(len(full_range.difference(df_coded["datetime"]))),
        "rows_all_sensors_missing": int(clean[C.BASE_FEATURES].isna().all(axis=1).sum()),
        # plausibility checks on valid (non-missing) values
        "rh_outside_0_100": int(((clean["RH"] < 0) | (clean["RH"] > 100)).sum()),
        "negative_sensor_values": int((clean[C.SENSOR_COLS] < 0).sum().sum()),
        "negative_reference_values": int((clean[C.REFERENCE_COLS] < 0).sum().sum()),
        "temperature_min_max": [float(clean["T"].min()), float(clean["T"].max())],
        "longest_identical_run_hours": {c: longest_run(clean[c]) for c in C.BASE_FEATURES},
    }
    return missing, report, clean


def build_model_table(df_coded):
    """Replace -200 by NaN, drop unusable columns/rows and return the modelling table.

    Decisions (justified in the report):
      * NMHC(GT) is ~90 % missing -> dropped as a column, never used.
      * Rows where the sensors/weather inputs are missing (device outage) -> dropped.
        All inputs vanish together, so there is nothing to impute from.
      * Rows where the target CO(GT) is missing -> dropped (no label to learn from).
      * No mean imputation anywhere: imputing a target would invent "reference" data.
    """
    num = numeric_columns(df_coded)
    df = df_coded.copy()
    df[num] = df[num].replace(C.MISSING_CODE, np.nan)

    outage = df[C.BASE_FEATURES].isna().any(axis=1)
    target_missing = df[C.TARGET].isna() & ~outage
    counts = {"rows_before": int(len(df)),
              "dropped_input_outage": int(outage.sum()),
              "dropped_target_missing_only": int(target_missing.sum())}

    keep = ~(outage | df[C.TARGET].isna())
    table = df.loc[keep, ["datetime", C.TARGET] + C.BASE_FEATURES].reset_index(drop=True)
    counts["rows_after"] = int(len(table))
    return table, counts, df


def split_chronological(table, train_frac=C.TRAIN_FRAC, val_frac=C.VAL_FRAC):
    """Split by time order (never shuffled): earliest 60 % train, next 20 % val, last 20 % test."""
    n = len(table)
    i_train = int(n * train_frac)
    i_val = int(n * (train_frac + val_frac))
    return (table.iloc[:i_train].copy(),
            table.iloc[i_train:i_val].copy(),
            table.iloc[i_val:].copy())
