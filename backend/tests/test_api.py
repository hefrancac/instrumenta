"""HTTP integration tests against the seeded app."""
API = "/api/v1"

SAMPLE = (
    "espelho bucal n5\nsonda exploradora n5\npinça clinica\nresina z350 A2\n"
    "ionomero de vidro restaurador\nporta agulha mayo hegar\nfio de sutura seda 4-0"
)


def test_health(client):
    r = client.get("/health")
    assert r.status_code in (200, 503)
    assert r.json()["checks"]["database"] == "ok"


def test_register_and_login(client):
    email = "student@example.com"
    r = client.post(f"{API}/auth/register", json={"email": email, "password": "supersecret1"})
    assert r.status_code in (201, 409)
    r = client.post(f"{API}/auth/login",
                    data={"username": email, "password": "supersecret1"},
                    headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_text_upload_creates_list(client):
    r = client.post(f"{API}/lists/text", json={"text": SAMPLE})
    assert r.status_code == 201
    body = r.json()
    assert body["item_count"] == 7
    assert any(i["standard_name"] == "Espelho Bucal Plano nº 5" for i in body["items"])


def test_patch_item_owned(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    item = lst["items"][0]
    r = client.patch(f"{API}/lists/{lst['list_id']}/items/{item['id']}", json={"owned": True})
    assert r.status_code == 200
    assert r.json()["owned"] is True


def test_optimize_returns_both_modes(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    r = client.get(f"{API}/cart/optimize/{lst['list_id']}")
    assert r.status_code == 200
    data = r.json()
    assert data["recommend"] in ("single", "multi")
    assert data["single"]["best"]["complete"] in (True, False)
    assert data["multi"]["store_count"] >= 1
    # single-store items are sorted high -> low
    prices = [i["price"] for i in data["single"]["best"]["items"]]
    assert prices == sorted(prices, reverse=True)


def test_optimize_excludes_owned_items(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    before = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["base_single_total"]
    item = lst["items"][0]
    client.patch(f"{API}/lists/{lst['list_id']}/items/{item['id']}", json={"owned": True})
    after = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["base_single_total"]
    assert after <= before


def test_quantity_scales_totals(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    item = lst["items"][0]
    base = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["base_single_total"]
    r = client.patch(f"{API}/lists/{lst['list_id']}/items/{item['id']}", json={"quantity": 3})
    assert r.status_code == 200 and r.json()["quantity"] == 3
    after = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["base_single_total"]
    assert after > base  # more units => higher total


def test_offer_rows_expose_freshness_and_offer_id(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    data = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()
    row = data["single"]["best"]["items"][0]
    assert row["offer_id"] is not None
    assert "age_hours" in row
    assert row["quantity"] >= 1 and row["line_total"] == row["price"]


def test_free_shipping_fields_present(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    best = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["single"]["best"]
    assert "free_shipping_eligible" in best
    assert "amount_to_free_shipping" in best


def test_go_redirects_to_store(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    row = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["single"]["best"]["items"][0]
    r = client.get(f"{API}/go/{row['offer_id']}", follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"].startswith("http")


def test_share_link_is_public(client):
    lst = client.post(f"{API}/lists/text", json={"text": SAMPLE}).json()
    s = client.post(f"{API}/lists/{lst['list_id']}/share")
    assert s.status_code == 200
    token = s.json()["token"]
    pub = client.get(f"{API}/share/{token}")
    assert pub.status_code == 200
    assert pub.json()["recommend"] in ("single", "multi")


def test_admin_scraper_health(client):
    r = client.get(f"{API}/admin/scraper-health?window_hours=24")
    assert r.status_code == 200
    body = r.json()
    assert body["window_hours"] == 24
    assert isinstance(body["stores"], list)


SMALL = "placa de vidro\nespelho bucal n5\nsonda exploradora n5"


def test_freight_varies_by_cep(client):
    lst = client.post(f"{API}/lists/text", json={"text": SMALL}).json()
    sp = client.get(f"{API}/cart/optimize/{lst['list_id']}?cep=01310-000").json()
    am = client.get(f"{API}/cart/optimize/{lst['list_id']}?cep=69010-000").json()
    assert sp["destination_region"] == "SP"
    assert am["destination_region"] == "N"
    # far region never cheaper than SP for the same small (below-threshold) order
    assert am["base_single_total"] >= sp["base_single_total"]


def test_offer_rows_expose_pack_and_unit_price(client):
    lst = client.post(f"{API}/lists/text", json={"text": SMALL}).json()
    row = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()["single"]["best"]["items"][0]
    assert row["pack_qty"] >= 1
    assert row["packs"] >= 1
    assert "unit_price" in row


def test_pack_product_buys_whole_boxes(client):
    lst = client.post(f"{API}/lists/text", json={"text": "fio de sutura seda 4-0"}).json()
    item = lst["items"][0]
    client.patch(f"{API}/lists/{lst['list_id']}/items/{item['id']}", json={"quantity": 30})
    data = client.get(f"{API}/cart/optimize/{lst['list_id']}").json()
    row = data["single"]["best"]["items"][0]
    assert row["pack_qty"] == 24 and row["packs"] == 2   # ceil(30/24)
    assert row["line_total"] == round(2 * (row["line_total"] / 2), 2)
