#!/usr/bin/env python3
"""Build a compact make/model catalogue from NZTA's open MVR service."""

import concurrent.futures
import hashlib
import json
import math
import pathlib
import urllib.parse
import urllib.request


ITEM_ID = "7b4df667d5014f1a93e6050b31d18407"
ITEM_URL = f"https://www.arcgis.com/sharing/rest/content/items/{ITEM_ID}?f=json"
YEARS = range(2000, 2027)
ROWS_PER_YEAR = 240
OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "vehicles.json"

POWERTRAINS = {
    "PETROL": "petrol",
    "PETROL HYBRID": "hybrid",
    "DIESEL": "diesel",
}


def get_json(url, params=None):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "nz-car-cost-calculator/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def title_case(value):
    value = " ".join((value or "").split())
    return value.title().replace("Phev", "PHEV").replace("Ev", "EV")


def fetch_year(query_url, year):
    stats = [{
        "statisticType": "count",
        "onStatisticField": "OBJECTID",
        "outStatisticFieldName": "vehicle_count",
    }]
    params = {
        "f": "json",
        "where": (
            f"VEHICLE_YEAR={year} AND CLASS IN ('MA','MB','MC') "
            "AND FC_COMBINED IS NOT NULL AND FC_COMBINED <> '0' "
            "AND MOTIVE_POWER IN ('PETROL','PETROL HYBRID','DIESEL')"
        ),
        "outStatistics": json.dumps(stats, separators=(",", ":")),
        "groupByFieldsForStatistics": "MAKE,MODEL,SUBMODEL,MOTIVE_POWER,FC_COMBINED",
        "orderByFields": "vehicle_count DESC",
        "resultRecordCount": ROWS_PER_YEAR,
        "returnGeometry": "false",
    }
    payload = get_json(query_url, params)
    if "error" in payload:
        raise RuntimeError(f"NZTA query failed for {year}: {payload['error']}")

    records = []
    for feature in payload.get("features", []):
        row = feature["attributes"]
        try:
            consumption = float(row["FC_COMBINED"])
        except (TypeError, ValueError):
            continue
        if not math.isfinite(consumption) or not 1 <= consumption <= 30:
            continue
        powertrain = POWERTRAINS.get(row.get("MOTIVE_POWER"))
        make = title_case(row.get("MAKE"))
        model = title_case(row.get("MODEL"))
        if not powertrain or not make or not model:
            continue
        variant = title_case(row.get("SUBMODEL")) or powertrain.title()
        identity = json.dumps([year, make, model, variant, powertrain, consumption, row.get("vehicle_count")], ensure_ascii=False)
        digest = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:10]
        records.append({
            "id": f"{year}-{make}-{model}".lower().replace(" ", "-")[:100] + f"-{digest}",
            "year": year,
            "make": make,
            "model": model,
            "variant": variant,
            "type": powertrain,
            "consumption": round(consumption, 1),
            "count": int(row.get("vehicle_count") or 0),
        })
    return records


def main():
    service = get_json(ITEM_URL).get("url")
    if not service:
        raise RuntimeError("The NZTA ArcGIS item did not return a feature service URL")
    query_url = f"{service.rstrip('/')}/0/query"

    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_year, query_url, year): year for year in YEARS}
        for future in concurrent.futures.as_completed(futures):
            records.extend(future.result())

    records.sort(key=lambda row: (-row["year"], row["make"], row["model"], -row["count"], row["variant"]))
    result = {
        "source": "NZ Transport Agency Motor Vehicle Register open data",
        "sourceUrl": "https://www.nzta.govt.nz/resources/new-zealand-motor-vehicle-register-statistics/new-zealand-vehicle-fleet-open-data-sets/",
        "method": "Most common registered passenger-vehicle variants by year; FC_COMBINED values are editable.",
        "records": records,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(records):,} vehicle variants to {OUTPUT}")


if __name__ == "__main__":
    main()
