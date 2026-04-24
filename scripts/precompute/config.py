"""
Configuration for the per-entity dashboard precompute pipeline.

Paths, entity-type registry, and shared constants used by aggregators and
generators. Mirrors the layout used by `ResourceVisualizations/scripts/precompute/config.py`.
"""

import os

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "static", "data")
OUTPUT_ROOT = os.path.join(DATA_DIR, "entity_dashboards")

# --------------------------------------------------------------------------
# Entity registry
# --------------------------------------------------------------------------

# Maps the EntityType used in the frontend to the output subdirectory.
# MUST stay in sync with `ENTITY_DIR` in
# `src/lib/utils/loaders/entityDashboardLoader.ts`.
ENTITY_DIRS = {
    "language": "languages",
    "subject": "subjects",
    "tag": "tags",
    "person": "people",
    "institution": "institutions",
    "genre": "genres",
    "resource-type": "resource-types",
    "group": "groups",
    "location": "locations",
    "research-section": "research-sections",
    "project": "projects",
    "research-item": "research-items",
}

# --------------------------------------------------------------------------
# MongoDB databases
# --------------------------------------------------------------------------

UNIVERSITY_DATABASES = [
    "projects_metadata_ubt",
    "projects_metadata_unilag",
    "projects_metadata_ujkz",
    "projects_metadata_ufba",
]

EXTERNAL_DATABASES = ["external_metadata"]

# --------------------------------------------------------------------------
# Aggregation parameters
# --------------------------------------------------------------------------

TOP_N_SUBJECTS = 25
TOP_N_WORDCLOUD = 150
TOP_N_CONTRIBUTORS = 20
TOP_N_LANGUAGES = 15

# Years outside this window are treated as noise and dropped from timelines.
MIN_YEAR = 1800
MAX_YEAR = 2100
