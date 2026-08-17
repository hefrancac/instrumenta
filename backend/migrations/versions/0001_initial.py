"""initial schema (v2)

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "stores",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("shipping_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("free_shipping_threshold", sa.Float(), nullable=True),
        sa.Column("shipping_per_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("base_url", sa.String(255)),
        sa.Column("affiliate_tag", sa.String(120), nullable=True),
        sa.Column("affiliate_template", sa.String(500), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(20), nullable=False, server_default="ok"),
    )

    op.create_table(
        "supply_lists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("share_token", sa.String(48), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cep", sa.String(9), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_supply_lists_user_id", "supply_lists", ["user_id"])
    op.create_index("ix_supply_lists_share_token", "supply_lists", ["share_token"], unique=True)

    op.create_table(
        "extracted_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("list_id", sa.Integer(), sa.ForeignKey("supply_lists.id", ondelete="CASCADE")),
        sa.Column("raw_name", sa.String(255), nullable=False),
        sa.Column("standard_name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(40), server_default="Material"),
        sa.Column("brand", sa.String(120), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("owned", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_extracted_items_list_id", "extracted_items", ["list_id"])
    op.create_index("ix_extracted_items_standard_name", "extracted_items", ["standard_name"])

    op.create_table(
        "product_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("store_id", sa.String(40), sa.ForeignKey("stores.id", ondelete="CASCADE")),
        sa.Column("standard_name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(120), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("ean", sa.String(20), nullable=True),
        sa.Column("pack_qty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float(), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="BRL"),
        sa.Column("url", sa.String(500)),
        sa.Column("image_url", sa.String(500)),
        sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1"),
        sa.Column("match_method", sa.String(20), nullable=False, server_default="seed"),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.String(20), nullable=False, server_default="scrape"),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("store_id", "standard_name", "brand", name="uq_offer"),
    )
    op.create_index("ix_product_cache_store_id", "product_cache", ["store_id"])
    op.create_index("ix_product_cache_standard_name", "product_cache", ["standard_name"])
    op.create_index("ix_product_cache_ean", "product_cache", ["ean"])
    op.create_index("ix_product_cache_last_updated", "product_cache", ["last_updated"])

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("list_id", sa.Integer(), sa.ForeignKey("supply_lists.id", ondelete="CASCADE")),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_jobs_list_id", "jobs", ["list_id"], unique=True)

    op.create_table(
        "product_match_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("store_id", sa.String(40)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("ean", sa.String(20), nullable=True),
        sa.Column("candidate_id", sa.String(80), nullable=True),
        sa.Column("candidate_name", sa.String(255), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("resolved_canonical", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pmr_store_id", "product_match_reviews", ["store_id"])
    op.create_index("ix_pmr_created_at", "product_match_reviews", ["created_at"])

    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("store_id", sa.String(40), nullable=False),
        sa.Column("query", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("results_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_scrape_runs_store_id", "scrape_runs", ["store_id"])
    op.create_index("ix_scrape_runs_created_at", "scrape_runs", ["created_at"])

    op.create_table(
        "clicks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("offer_id", sa.Integer(),
                  sa.ForeignKey("product_cache.id", ondelete="SET NULL"), nullable=True),
        sa.Column("store_id", sa.String(40)),
        sa.Column("standard_name", sa.String(255)),
        sa.Column("list_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(700)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_clicks_store_id", "clicks", ["store_id"])
    op.create_index("ix_clicks_created_at", "clicks", ["created_at"])


def downgrade() -> None:
    for t in ("clicks", "scrape_runs", "product_match_reviews", "jobs",
              "product_cache", "extracted_items", "supply_lists", "stores", "users"):
        op.drop_table(t)
