"""Feature engineering and feature sets."""
import numpy as np

from . import config as C

TIME_FEATURES = ["hour_sin", "hour_cos", "is_weekend"]
ENGINEERED_FEATURES = C.BASE_FEATURES + TIME_FEATURES


def add_time_features(df):
    """Add calendar features derived ONLY from the timestamp (no target information).

    * hour_sin / hour_cos: hour of day on a circle, so 23:00 and 00:00 are neighbours
      (a plain 0-23 number would put them 23 units apart).
    * is_weekend: traffic - the main CO source - differs on Saturdays/Sundays.
    Month is deliberately NOT a feature: the test months never appear in training, so
    a month feature could not generalise and would only memorise the calendar.
    """
    out = df.copy()
    hour = out["datetime"].dt.hour
    out["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    out["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    out["is_weekend"] = (out["datetime"].dt.dayofweek >= 5).astype(int)
    return out
