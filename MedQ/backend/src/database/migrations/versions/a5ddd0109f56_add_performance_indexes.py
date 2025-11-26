"""add performance indexes

Revision ID: a5ddd0109f56
Revises: 4573bbc7a65a
Create Date: 2025-11-20 07:50:09.584020

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5ddd0109f56'
down_revision: Union[str, Sequence[str], None] = '4573bbc7a65a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
