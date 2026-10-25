"""
Small, additive schema upgrades for databases created before a column existed.

`create_all` makes new tables but never changes existing ones, so columns added to a model later
are added here with ALTER TABLE ... ADD COLUMN (works on SQLite and Postgres). Nothing is dropped
or renamed; to start from scratch use `python -m app.seed_data --reset`.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

from app.database import Base

# Values for rows that existed before the column did (applied once, right after adding it).
BACKFILL = {
    ("appointments", "duration_minutes"): "20",
    ("appointments", "visit_status"): "'scheduled'",
}


def add_missing_columns(conn: Connection) -> list[str]:
    """Add every model column the database table lacks. Returns 'table.column' for each one added."""
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())
    added: list[str] = []
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # create_all made it with every column
        have = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in have:
                continue
            col_type = column.type.compile(dialect=conn.dialect)
            conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}'))
            fill = BACKFILL.get((table.name, column.name))
            if fill is not None:
                conn.execute(text(f"UPDATE {table.name} SET {column.name} = {fill} WHERE {column.name} IS NULL"))
            added.append(f"{table.name}.{column.name}")
    return added
