from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

import pandas as pd


def export_csv(rows: Iterable[dict], output_path: str | Path) -> str:
    df = pd.DataFrame(rows)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    return str(path)


def export_excel(rows: Iterable[dict], output_path: str | Path) -> str:
    df = pd.DataFrame(rows)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(path, index=False, engine="openpyxl")
    return str(path)
