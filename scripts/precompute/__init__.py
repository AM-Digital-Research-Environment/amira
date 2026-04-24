"""
Per-entity dashboard precompute package.

Parallels the Omeka S `ResourceVisualizations` module's `scripts/precompute/`
package. Each entity type has a generator that composes `build_*` aggregators
into a single JSON payload keyed by ChartKey.

Modules:
    config       - Paths, entity registry, output layout.
    db           - MongoDB helpers + unified load_all_items().
    aggregators  - Per-chart build_* functions. Output shapes match
                   `references/visualization-patterns.md` from the
                   wisski-mongodb skill.
    generators   - Per-entity generate_* functions. Each returns a dict
                   ready to serialize under static/data/entity_dashboards/.
"""
