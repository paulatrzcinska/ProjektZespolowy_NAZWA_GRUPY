from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config


def test_migrations_generate_postgresql_sql_without_a_database() -> None:
    output = StringIO()
    config = Config(
        str(Path(__file__).resolve().parents[2] / "db" / "alembic.ini"),
        output_buffer=output,
    )
    command.upgrade(config, "head", sql=True)
    upgrade = output.getvalue()

    assert "CREATE TABLE users" in upgrade
    assert "CREATE TABLE payments" in upgrade
    assert upgrade.count("CREATE TYPE order_status") == 1
    assert upgrade.count("CREATE TYPE payment_status") == 1
    output.seek(0)
    output.truncate()
    command.downgrade(config, "head:base", sql=True)
    downgrade = output.getvalue()
    assert "DROP TYPE order_status" in downgrade
    assert "DROP TYPE payment_status" in downgrade
