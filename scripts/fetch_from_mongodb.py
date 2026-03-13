"""
Fetch data from MongoDB and export as JSON files for the WissKI dashboard.

READ-ONLY: This script only reads from MongoDB (collection.find()).
It does NOT modify, insert, update, or delete any data.

Usage:
    python scripts/fetch_from_mongodb.py
    python scripts/fetch_from_mongodb.py --uri "mongodb://user:pass@host:27017/?authSource=dev"

Requires:
    pip install pymongo

You must be connected to the university VPN for this to work.
"""

import argparse
import json
import os
import sys
from pymongo import MongoClient, ReadPreference
from bson import json_util

# MongoDB connection — set MONGO_URI environment variable or use --uri flag
DEFAULT_MONGO_URI = os.environ.get("MONGO_URI", "")

# Output directory (relative to project root)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "static", "data")

# Database and collection mappings
# Format: (database_name, collection_name, output_subdirectory, output_filename)
DEV_COLLECTIONS = [
    ("dev", "persons", "dev", "dev.persons.json"),
    ("dev", "groups", "dev", "dev.groups.json"),
    ("dev", "institutions", "dev", "dev.institutions.json"),
    ("dev", "projectsData", "dev", "dev.projectsData.json"),
    ("dev", "collections", "dev", "dev.collections.json"),
    ("dev", "geoloc_countries", "dev", "dev.geoloc_countries.json"),
    ("dev", "geoloc_regions", "dev", "dev.geoloc_regions.json"),
    ("dev", "geoloc_subregions", "dev", "dev.geoloc_subregions.json"),
]

# University project collections
# Maps university folder to list of project collection names
UNIVERSITY_PROJECTS = {
    "projects_metadata_ubt": [
        "UBT_ArtWorld2019",
        "UBT_CLnCK2019",
        "UBT_Covid192021",
        "UBT_DigiRet2021",
        "UBT_HDMC2019",
        "UBT_Humanitar2019",
        "UBT_Karakul2019",
        "UBT_LearnClass2019",
        "UBT_MaL2019",
        "UBT_MiConIturi2019",
        "UBT_MoCapIE2021",
        "UBT_MuDAIMa-PRJ2019",
        "UBT_MuDAIMa2019",
        "UBT_MultiALS2021",
        "UBT_OilMov2019",
        "UBT_PEMESWA2021",
        "UBT_Plura2021",
        "UBT_TaiSha2021",
        "UBT_TravKnowl2019",
        "UBT_preDeath2021",
    ],
    "projects_metadata_unilag": [
        "ULG_AfEnt2020",
        "ULG_EthDump2021",
        "ULG_IWCVD2021",
        "ULG_LOI2021",
        "ULG_MFWA2021",
        "ULG_MRC2021",
        "ULG_WOPP2021",
        "ULG_YoruFolk2020",
    ],
    "projects_metadata_ujkz": [
        "UJKZ_FluOnt2023",
        "UJKZ_GLOBHEALTH2020",
        "UJKZ_KnowFranco2021",
        "UJKZ_SEDPaix2022",
    ],
    "projects_metadata_ufba": [
        "UFB_AfroDigital",
    ],
}


def export_collection(client, db_name, collection_name, output_path):
    """Export a MongoDB collection to a JSON file using MongoDB Extended JSON."""
    db = client[db_name]
    collection = db[collection_name]

    documents = list(collection.find())
    count = len(documents)

    # Use json_util to preserve MongoDB Extended JSON format ($oid, $date, etc.)
    json_str = json_util.dumps(documents, indent=2, ensure_ascii=False)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(json_str)

    return count


def main():
    parser = argparse.ArgumentParser(description="Fetch WissKI data from MongoDB")
    parser.add_argument("--uri", default=DEFAULT_MONGO_URI, help="MongoDB connection URI")
    parser.add_argument(
        "--auth-db",
        default=None,
        help="Authentication database (e.g. 'dev', 'admin'). Overrides authSource in URI.",
    )
    args = parser.parse_args()

    uri = args.uri
    if not uri:
        print("Error: No MongoDB URI provided.")
        print("Set the MONGO_URI environment variable or use --uri flag.")
        sys.exit(1)

    connect_kwargs = {
        "serverSelectionTimeoutMS": 5000,
        "read_preference": ReadPreference.SECONDARY_PREFERRED,
    }
    if args.auth_db:
        connect_kwargs["authSource"] = args.auth_db

    print("Connecting to MongoDB...")
    try:
        client = MongoClient(uri, **connect_kwargs)
        # Test connection with a lightweight command
        client.admin.command("ping")
        print("Connected successfully!\n")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        print("\nTroubleshooting:")
        print("  - Make sure you are connected to the VPN")
        print("  - Try specifying the auth database: --auth-db dev")
        print('  - Or add authSource to the URI: ".../?authSource=dev"')
        sys.exit(1)

    total_collections = 0
    total_documents = 0

    # Export dev collections
    print("=== Dev collections ===")
    for db_name, coll_name, subdir, filename in DEV_COLLECTIONS:
        output_path = os.path.join(DATA_DIR, subdir, filename)
        try:
            count = export_collection(client, db_name, coll_name, output_path)
            print(f"  {filename}: {count} documents")
            total_collections += 1
            total_documents += count
        except Exception as e:
            print(f"  {filename}: ERROR - {e}")

    # Export university project collections
    for folder, projects in UNIVERSITY_PROJECTS.items():
        # Derive the database name from the folder
        db_name = folder
        print(f"\n=== {folder} ===")
        for project in projects:
            filename = f"{folder}.{project}.json"
            output_path = os.path.join(DATA_DIR, folder, filename)
            try:
                count = export_collection(client, db_name, project, output_path)
                print(f"  {filename}: {count} documents")
                total_collections += 1
                total_documents += count
            except Exception as e:
                print(f"  {filename}: ERROR - {e}")

    client.close()
    print(f"\nDone! Exported {total_documents} documents from {total_collections} collections.")


if __name__ == "__main__":
    main()
