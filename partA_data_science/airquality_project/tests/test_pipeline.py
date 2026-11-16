"""Sanity tests for the things the project claims: no leakage, right cleaning, reproducible.

Run from the project root:   python -m pytest -q      (or: python tests/test_pipeline.py)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src import config as C
from src import data, evaluate, features, models


def _table():
    df_coded, _ = data.load_raw()
    table, counts, _ = data.build_model_table(df_coded)
    return features.add_time_features(table), counts


def test_structure_cleaning():
    df, info = data.load_raw()
    assert info["raw_cols"] == 17 and info["cols"] == 15         # 2 empty columns removed
    assert df.shape[1] == 14                                      # Date+Time merged into one datetime column
    assert df["datetime"].is_monotonic_increasing and not df["datetime"].duplicated().any()


def test_no_missing_codes_left_in_model_table():
    table, counts = _table()
    assert not (table.drop(columns="datetime") == C.MISSING_CODE).any().any()
    assert not table.isna().any().any()
    assert counts["rows_after"] == len(table)


def test_split_is_chronological_and_disjoint():
    table, _ = _table()
    tr, va, te = data.split_chronological(table)
    assert tr["datetime"].max() < va["datetime"].min() <= va["datetime"].max() < te["datetime"].min()
    assert len(tr) + len(va) + len(te) == len(table)
    assert set(tr.index).isdisjoint(va.index) and set(va.index).isdisjoint(te.index)


def test_features_exclude_other_reference_columns():
    used = set(features.ENGINEERED_FEATURES) | set(C.SIMPLE_FEATURE)
    assert not used & set(C.REFERENCE_COLS)                      # no CO/NOx/NO2/benzene reference inputs


def test_scaler_is_fitted_on_training_rows_only():
    table, _ = _table()
    tr, va, te = data.split_chronological(table)
    pipe = models.build_models()["M2 Multiple linear (8 inputs)"][0]
    pipe.fit(tr[C.BASE_FEATURES], tr[C.TARGET])
    scaler = [s for _, s in pipe.steps if isinstance(s, StandardScaler)][0]
    np.testing.assert_allclose(scaler.mean_, tr[C.BASE_FEATURES].mean().values)   # train means, not all-data means


def test_time_cv_never_trains_on_the_future():
    X = np.arange(500)
    for tr_idx, te_idx in models.time_cv().split(X):
        assert tr_idx.max() + C.CV_GAP_HOURS < te_idx.min()


def test_deterministic_metrics():
    table, _ = _table()
    tr, va, te = data.split_chronological(table)
    est = models.build_models()["M3 Multiple linear (+time features)"][0]
    a = est.fit(tr[features.ENGINEERED_FEATURES], tr[C.TARGET]).predict(va[features.ENGINEERED_FEATURES])
    b = est.fit(tr[features.ENGINEERED_FEATURES], tr[C.TARGET]).predict(va[features.ENGINEERED_FEATURES])
    np.testing.assert_array_equal(a, b)
    m = evaluate.regression_metrics([1, 2, 3], [1, 2, 4])
    assert abs(m["MAE"] - 1 / 3) < 1e-12 and abs(m["MSE"] - 1 / 3) < 1e-12


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok  ", name)
