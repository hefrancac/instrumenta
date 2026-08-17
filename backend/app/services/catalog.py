"""
Canonical product taxonomy for dental supplies.

This single source of truth powers three things:
  1. Name standardization (matcher.py maps messy list text -> a canonical entry).
  2. Deterministic seed data for local/dev environments (generate_offers()).
  3. The set of brands the frontend offers as toggles (e.g. 3M vs. genérico).

Keeping it pure (no third-party imports) means the optimizer and matcher can be
unit-tested without a database, and the same catalog seeds ProductCache in dev.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
# `factor` scales a brand's base price for that store (a stand-in for the real
# per-store pricing the scraper will populate). `shipping` is the flat frete.
STORES: list[dict] = [
    {"id": "cremer",   "name": "Dental Cremer",   "factor": 1.00, "shipping": 24.90, "ship_per_kg": 9.50,  "free_shipping": 99.00,  "affiliate_tag": "instrumenta",  "base_url": "https://www.dentalcremer.com.br"},
    {"id": "surya",    "name": "Surya Dental",    "factor": 0.90, "shipping": 19.90, "ship_per_kg": 8.90,  "free_shipping": 129.00, "affiliate_tag": "instrumenta",  "base_url": "https://www.suryadental.com.br"},
    {"id": "speed",    "name": "Dental Speed",    "factor": 1.05, "shipping": 27.90, "ship_per_kg": 10.50, "free_shipping": 149.00, "affiliate_tag": "instrumenta",  "base_url": "https://www.dentalspeed.com"},
]
STORE_BY_ID: dict[str, dict] = {s["id"]: s for s in STORES}


@dataclass(frozen=True)
class Brand:
    name: str
    base_price: float
    premium: bool = False


@dataclass(frozen=True)
class ProductDef:
    id: str
    standard_name: str
    category: str            # "Instrumental" | "Material"
    keywords: tuple[str, ...]
    brands: tuple[Brand, ...]


def _p(*brands: Brand) -> tuple[Brand, ...]:
    return tuple(brands)


CATALOG: list[ProductDef] = [
    ProductDef("espelho", "Espelho Bucal Plano nº 5", "Instrumental", ("espelho", "bucal"),
               _p(Brand("Golgran", 14.90, True), Brand("Genérico", 8.90))),
    ProductDef("cabo-esp", "Cabo para Espelho Bucal", "Instrumental", ("cabo", "espelho"),
               _p(Brand("Golgran", 11.90))),
    ProductDef("sonda-exp", "Sonda Exploradora nº 5", "Instrumental", ("sonda", "exploradora"),
               _p(Brand("Golgran", 13.50))),
    ProductDef("sonda-per", "Sonda Periodontal Williams", "Instrumental", ("sonda", "periodontal", "milimetrada", "williams"),
               _p(Brand("Golgran", 22.90))),
    ProductDef("pinca", "Pinça Clínica", "Instrumental", ("pinca", "clinica"),
               _p(Brand("Golgran", 16.90))),
    ProductDef("esp-ins", "Espátula de Inserção nº 1 (Thompson)", "Instrumental", ("insercao", "thompson", "ward"),
               _p(Brand("Duflex", 19.90))),
    ProductDef("esp-res", "Espátula para Resina (Suprafill)", "Instrumental", ("espatula", "suprafill"),
               _p(Brand("Duflex", 24.90))),
    ProductDef("escav", "Escavador / Colher de Dentina nº 17", "Instrumental", ("escavador", "cureta", "dentina", "colher"),
               _p(Brand("Duflex", 18.90))),
    ProductDef("cond", "Condensador de Amálgama", "Instrumental", ("condensador", "amalgama"),
               _p(Brand("Duflex", 21.90))),
    ProductDef("toffle", "Porta-Matriz de Tofflemire", "Instrumental", ("matriz", "tofflemire"),
               _p(Brand("Golgran", 44.90))),
    ProductDef("bisturi", "Cabo de Bisturi nº 3", "Instrumental", ("bisturi",),
               _p(Brand("ABC", 15.90))),
    ProductDef("porta-ag", "Porta-Agulha Mayo-Hegar 14cm", "Instrumental", ("agulha", "mayo", "hegar"),
               _p(Brand("Golgran", 59.90))),
    ProductDef("tesoura", "Tesoura Íris Reta", "Instrumental", ("tesoura", "iris", "goldman"),
               _p(Brand("Golgran", 34.90))),
    ProductDef("alavanca", "Alavanca Seldin nº 2 Reta", "Instrumental", ("alavanca", "seldin"),
               _p(Brand("Quinelato", 39.90))),
    ProductDef("forceps", "Fórceps nº 150 (Adulto)", "Instrumental", ("forceps", "150"),
               _p(Brand("Quinelato", 74.90))),
    ProductDef("molt", "Destaca-Periósteo Molt", "Instrumental", ("destaca", "periosteo", "molt", "sindesmotomo"),
               _p(Brand("Quinelato", 42.90))),
    ProductDef("placa", "Placa de Vidro para Manipulação", "Instrumental", ("placa", "vidro"),
               _p(Brand("SS White", 19.90))),
    ProductDef("resina", "Resina Composta Z350 XT (A2)", "Material", ("resina", "z350", "filtek"),
               _p(Brand("3M Filtek", 129.90, True), Brand("FGM Opallis", 79.90))),
    ProductDef("ionomero", "Ionômero de Vidro Restaurador", "Material", ("ionomero", "vidrion", "ketac", "maxxion"),
               _p(Brand("3M Ketac", 89.90, True), Brand("SS White Vidrion", 44.90))),
    ProductDef("adesivo", "Sistema Adesivo (Single Bond)", "Material", ("adesivo", "single", "bond", "ambar"),
               _p(Brand("3M Single Bond", 99.90, True), Brand("FGM Ambar", 64.90))),
    ProductDef("acido", "Condicionador Ácido Fosfórico 37%", "Material", ("acido", "condicionador", "fosforico"),
               _p(Brand("FGM", 14.90))),
    ProductDef("brocas", "Kit de Brocas Diamantadas", "Material", ("broca", "brocas", "diamantada"),
               _p(Brand("KG Sorensen", 49.90))),
    ProductDef("dique", "Lençol de Borracha / Dique (caixa)", "Material", ("lencol", "borracha", "dique", "isolamento"),
               _p(Brand("Madeitex", 34.90))),
    ProductDef("soflex", "Discos de Lixa para Acabamento (kit)", "Material", ("disco", "discos", "lixa"),
               _p(Brand("3M Sof-Lex", 59.90, True), Brand("TDV Pop On", 44.90))),
    ProductDef("sutura", "Fio de Sutura Seda 4-0 (caixa)", "Material", ("sutura", "seda", "nylon"),
               _p(Brand("Shalon", 39.90))),

    # ---- Expansão do catálogo (itens de lista de semestre real) -------------
    # Prótese
    ProductDef("manequim", "Manequim de Dentística", "Instrumental", ("manequim",),
               _p(Brand("Pronew", 219.90))),
    ProductDef("espessimetro", "Espessímetro Odontológico", "Instrumental", ("espessimetro",),
               _p(Brand("Ice", 39.90))),
    ProductDef("moldeira-total", "Moldeira de Moldagem Total (kit)", "Instrumental", ("moldeira", "total", "totais"),
               _p(Brand("Bioart", 49.90, True), Brand("Genérico", 32.90))),
    ProductDef("moldeira-parcial", "Moldeira Parcial Perfurada", "Instrumental", ("moldeira", "parcial", "parciais"),
               _p(Brand("Tecnodent", 12.90))),
    ProductDef("espatula-alginato", "Espátula Plástica para Alginato", "Instrumental", ("alginato", "plastica"),
               _p(Brand("Jon", 9.90))),
    ProductDef("gral-alginato", "Gral de Borracha para Alginato", "Instrumental", ("gral", "grau", "alginato"),
               _p(Brand("Jon", 12.90))),
    ProductDef("injetor-elast", "Injetor de Elastômero", "Instrumental", ("injetor", "elastomero"),
               _p(Brand("Maquira", 24.90, True), Brand("Jon", 16.90))),
    ProductDef("dappen", "Pote Dappen de Silicone", "Instrumental", ("dappen",),
               _p(Brand("Jon", 6.90))),
    ProductDef("pincel", "Pincel para Aplicação", "Instrumental", ("pincel",),
               _p(Brand("Tigre", 8.90))),
    ProductDef("vaselina", "Vaselina Sólida", "Material", ("vaselina",),
               _p(Brand("Rioquímica", 12.90))),
    ProductDef("adaptador-cr", "Adaptador de Contra-Ângulo para FG", "Instrumental", ("adaptador", "contra"),
               _p(Brand("NSK", 34.90))),
    ProductDef("ponta-diam", "Ponta Diamantada (unidade)", "Material", ("ponta", "diamantada"),
               _p(Brand("KG Sorensen", 6.90))),
    ProductDef("maxicut", "Broca Maxicut", "Material", ("maxicut", "broca"),
               _p(Brand("Edenta", 44.90))),
    ProductDef("kit-polimento", "Kit de Acabamento e Polimento de Provisório", "Material", ("acabamento", "polimento", "provisoria"),
               _p(Brand("Edenta", 89.90))),
    ProductDef("dente-acrilico", "Dente de Acrílico para Estudo", "Material", ("dente", "dentes", "acrilico"),
               _p(Brand("Pronew", 9.90))),
    ProductDef("esculpidor", "Esculpidor de Hollemback 3S", "Instrumental", ("esculpidor", "hollemback", "hollenback"),
               _p(Brand("Millennium", 29.90))),
    # Endodontia
    ProductDef("sonda-endo", "Sonda Endodôntica", "Instrumental", ("sonda", "endodontica"),
               _p(Brand("Rhein", 29.90))),
    ProductDef("esp-flex-endo", "Espátula Flexível para Endodontia", "Instrumental", ("flexivel", "endodontia"),
               _p(Brand("Odus", 24.90))),
    ProductDef("lima-endo", "Lima Endodôntica (caixa)", "Material", ("lima",),
               _p(Brand("Maillefer", 44.90, True), Brand("Genérico", 24.90))),
    ProductDef("gates", "Brocas Gates Glidden (kit)", "Material", ("gates", "glidden", "brocas"),
               _p(Brand("Maillefer", 39.90))),
    ProductDef("cone-guta", "Cones de Guta-percha (caixa)", "Material", ("guta", "cones"),
               _p(Brand("Odous", 29.90, True), Brand("Tanari", 19.90))),
    ProductDef("cone-papel", "Pontas de Papel Absorvente (caixa)", "Material", ("papel", "absorvente"),
               _p(Brand("Tanari", 19.90))),
    ProductDef("cimento-endo", "Cimento Endodôntico (Endofill)", "Material", ("endofill",),
               _p(Brand("Dentsply", 64.90))),
    ProductDef("espacador", "Espaçador Digital Endodôntico", "Instrumental", ("espacador",),
               _p(Brand("Odus", 22.90))),
    ProductDef("cond-endo", "Condensador Endodôntico", "Instrumental", ("condensador", "endodontico"),
               _p(Brand("Odus", 34.90))),
    ProductDef("tamborel", "Tamborel Metálico", "Instrumental", ("tamborel",),
               _p(Brand("Golgran", 34.90))),
    ProductDef("regua-mm", "Régua Milimetrada de Aço", "Instrumental", ("regua", "milimetrada"),
               _p(Brand("Golgran", 16.90))),
    ProductDef("seringa", "Seringa Hipodérmica Descartável (c/ agulha)", "Material", ("seringa", "hipodermica"),
               _p(Brand("BD", 1.90))),
    # Dentística
    ProductDef("alicate-121", "Alicate 121", "Instrumental", ("alicate",),
               _p(Brand("Golgran", 44.90, True), Brand("Genérico", 29.90))),
    ProductDef("microbrush", "Aplicador Descartável (Microbrush)", "Material", ("microbrush", "aplicador"),
               _p(Brand("KG", 19.90))),
    ProductDef("pasta-polimento", "Pasta para Polimento de Resina", "Material", ("pasta", "polimento"),
               _p(Brand("Diamond", 34.90))),
    ProductDef("porta-dycal", "Porta Hidróxido de Cálcio (Porta Dycal)", "Instrumental", ("dycal",),
               _p(Brand("Golgran", 24.90))),
    ProductDef("arco-young", "Arco de Young", "Instrumental", ("young",),
               _p(Brand("Golgran", 19.90))),
    ProductDef("perfurador", "Perfurador de Lençol (Ainsworth/Ivory)", "Instrumental", ("perfurador", "pergurador", "ainsworth", "ivory"),
               _p(Brand("Golgran", 89.90))),
    ProductDef("porta-grampo", "Pinça Porta-Grampo (Palmer)", "Instrumental", ("palmer", "porta"),
               _p(Brand("Golgran", 79.90))),
    ProductDef("grampo", "Grampo para Isolamento (aço inox)", "Instrumental", ("grampo",),
               _p(Brand("Golgran", 12.90, True), Brand("Genérico", 7.90))),
    ProductDef("fio-dental", "Fio Dental", "Material", ("fio",),
               _p(Brand("Johnson", 6.90))),
    ProductDef("tira-lixa", "Tira de Lixa de Acabamento", "Material", ("tira", "lixa"),
               _p(Brand("3M", 15.90, True), Brand("TDV", 12.90))),
    ProductDef("cunha", "Cunha de Madeira (sortida)", "Material", ("cunha", "madeira"),
               _p(Brand("TDV", 14.90))),
    ProductDef("matriz-fita", "Fita Matriz Metálica / Poliéster", "Material", ("fita", "matriz", "poliester"),
               _p(Brand("TDV", 9.90))),
    ProductDef("oculos", "Óculos de Proteção", "Material", ("oculos",),
               _p(Brand("Verion", 14.90))),
    ProductDef("casulo", "Casulo para Resinas e Adesivos", "Material", ("casulo", "resinas"),
               _p(Brand("Maquira", 12.90))),
    ProductDef("polidor-espiral", "Kit de Polidores Espirais Diamantados", "Material", ("polidores", "espirais", "espiral"),
               _p(Brand("American Burrs", 49.90))),
    # Lote 2 — itens distintos que faltavam
    ProductDef("torno", "Torno de Bancada", "Instrumental", ("torno",),
               _p(Brand("Tornim", 289.90))),
    ProductDef("macarico", "Maçarico", "Instrumental", ("macarico",),
               _p(Brand("Blazer", 129.90))),
    ProductDef("condutor-calor", "Condutor de Calor Endodôntico", "Instrumental", ("condutor", "calor"),
               _p(Brand("Odus", 34.90))),
    ProductDef("lucas", "Instrumento de Lucas (Cureta)", "Instrumental", ("lucas",),
               _p(Brand("Millennium", 39.90))),
    ProductDef("pote-vidro", "Pote de Vidro", "Instrumental", ("pote", "vidro"),
               _p(Brand("Nevoni", 19.90))),
    ProductDef("caneta-hidro", "Caneta Hidrocor / Marcadora", "Material", ("caneta", "hidrocor"),
               _p(Brand("Pilot", 4.90))),
    ProductDef("esp-cimento", "Espátula para Manipulação de Cimentos", "Instrumental", ("manipulacao", "cimentos"),
               _p(Brand("Golgran", 18.90))),
    ProductDef("arco-microcut", "Arco Microcut (Porta-Matriz)", "Instrumental", ("microcut",),
               _p(Brand("TDV", 34.90))),
    ProductDef("unimatrix", "Kit de Matrizes Unimatrix", "Material", ("unimatrix", "matriz"),
               _p(Brand("TDV", 29.90))),
    ProductDef("fresa", "Fresa Multilaminada", "Material", ("fresa",),
               _p(Brand("Angelus", 24.90))),
    ProductDef("broqueiro", "Broqueiro de Alumínio", "Instrumental", ("broqueiro",),
               _p(Brand("Jon", 29.90))),
    ProductDef("escova-broca", "Escova para Limpar Brocas", "Instrumental", ("escova", "limpar", "brocas"),
               _p(Brand("Preven", 12.90))),
    ProductDef("esp-dupla", "Espátula Dupla nº 3051", "Instrumental", ("dupla", "3051"),
               _p(Brand("Millennium", 24.90))),
    ProductDef("calcador", "Calcador Duplo nº 3101", "Instrumental", ("calcador",),
               _p(Brand("Millennium", 26.90))),
    ProductDef("alicate-curvar", "Alicate de Curvar Lima", "Instrumental", ("alicate", "curvar"),
               _p(Brand("Odus", 39.90))),
    ProductDef("esp-alm", "Espátula ALM", "Instrumental", ("espatula", "alm"),
               _p(Brand("Millennium", 22.90))),
    ProductDef("esp-sd2", "Espátula SD2", "Instrumental", ("espatula", "sd2"),
               _p(Brand("Millennium", 23.90))),
    ProductDef("rotate-kit", "Limas Rotatórias (Rotate Kit)", "Material", ("rotate",),
               _p(Brand("VDW", 189.90))),
    # Lote 3 — correções da auditoria (subtipos que caíam em item parecido)
    ProductDef("espatula-cera", "Espátula para Cera nº 24/36/50", "Instrumental", ("espatula", "36", "50"),
               _p(Brand("Duflex", 17.90))),
    ProductDef("broca-carbide", "Broca Carbide 1557/1568/245", "Material", ("broca", "carbide", "1557", "1568", "245"),
               _p(Brand("KG Sorensen", 29.90))),
    ProductDef("broca-esferica", "Broca Esférica (baixa rotação)", "Material", ("broca", "esferica", "tungstenio"),
               _p(Brand("KG Sorensen", 19.90))),
    ProductDef("tira-matriz-aco", "Tira Matriz de Aço", "Material", ("tira", "aco"),
               _p(Brand("TDV", 12.90))),
    ProductDef("broca-endoz", "Broca Endo Z", "Material", ("broca", "endo"),
               _p(Brand("Dentsply", 39.90))),
]
CATALOG_BY_ID: dict[str, ProductDef] = {p.id: p for p in CATALOG}
CATALOG_BY_STD: dict[str, ProductDef] = {p.standard_name: p for p in CATALOG}

# Realistic availability gaps: (product_id, store_id) pairs that are out of stock.
# Mirrors the real world — no single store carries the entire list.
OUT_OF_STOCK: set[tuple[str, str]] = {
    ("porta-ag", "surya"),
    ("sonda-per", "speed"), ("esp-res", "speed"), ("toffle", "speed"),
    ("tesoura", "speed"), ("forceps", "speed"), ("brocas", "speed"),
    ("soflex", "speed"), ("ionomero", "speed"), ("adesivo", "speed"),
}

# Equipamento especializado que as dentais gerais não estocam de forma confiável:
# reconhecemos o item, mas NÃO inventamos preço/loja (evita preço fake e link ruim).
# Estes aparecem como "preço a confirmar". Ajuste conforme o mercado real.
NO_ESTIMATE: set[str] = {"torno", "macarico", "manequim", "espessimetro"}


# EAN/GTIN → canonical product id. The most reliable matching key; populated over
# time from scraping/feeds. A few illustrative codes so EAN matching is testable.
EAN_TO_ID: dict[str, str] = {
    "7898906320011": "espelho",
    "7891234000027": "sonda-exp",
    "7898153470034": "pinca",
    "7896548120041": "resina",
    "7898212560058": "ionomero",
    "7891010900069": "sutura",
}
ID_TO_EAN: dict[str, str] = {v: k for k, v in EAN_TO_ID.items()}


# Shipping weight (grams, incl. packaging) per base unit. Default ~60g. Glass and
# heavy forceps weigh more; small materials less — this drives freight-by-weight.
DEFAULT_WEIGHT_G = 60.0
PRODUCT_WEIGHT_G: dict[str, float] = {
    "espelho": 40, "cabo-esp": 55, "sonda-exp": 40, "sonda-per": 45, "pinca": 55,
    "esp-ins": 50, "esp-res": 55, "escav": 50, "cond": 80, "toffle": 90,
    "bisturi": 60, "porta-ag": 140, "tesoura": 90, "alavanca": 120, "forceps": 180,
    "molt": 110, "placa": 250, "resina": 30, "ionomero": 45, "adesivo": 40,
    "acido": 60, "brocas": 60, "dique": 300, "soflex": 40, "sutura": 60,
}

# How many base units a typical listing contains (a box/kit). Default 1 (avulso).
PRODUCT_PACK: dict[str, int] = {
    "sutura": 24,   # fio de sutura — caixa com 24
    "dique": 26,    # lençol de borracha — caixa com 26 folhas
    "brocas": 6,    # kit com 6 brocas
}

# Human label for what one "pack" is called, used to build realistic titles.
_PACK_LABEL: dict[str, str] = {"sutura": "Caixa com {n}", "dique": "Caixa com {n} folhas",
                               "brocas": "Kit com {n}"}


def weight_g(product_id: str) -> float:
    return PRODUCT_WEIGHT_G.get(product_id, DEFAULT_WEIGHT_G)


def pack_of(product_id: str) -> int:
    return PRODUCT_PACK.get(product_id, 1)


WEIGHT_BY_STD: dict[str, float] = {p.standard_name: weight_g(p.id) for p in CATALOG}
PACK_BY_STD: dict[str, int] = {p.standard_name: pack_of(p.id) for p in CATALOG}


@dataclass(frozen=True)
class SeedOffer:
    standard_name: str
    store_id: str
    store_name: str
    brand: str
    price: float
    shipping: float
    url: str
    title: str
    ean: Optional[str] = None
    pack_qty: int = 1
    unit_price: Optional[float] = None
    in_stock: bool = True


def generate_offers() -> list[SeedOffer]:
    """Deterministically expand the catalog into per-store, per-brand offers.

    Used to seed ProductCache in dev so the whole pipeline (upload -> optimize)
    returns believable results without hitting live stores.
    """
    offers: list[SeedOffer] = []
    for prod in CATALOG:
        if prod.id in NO_ESTIMATE:
            continue                      # sem preço estimado — "a confirmar"
        ean = ID_TO_EAN.get(prod.id)
        pack = pack_of(prod.id)
        for store in STORES:
            if (prod.id, store["id"]) in OUT_OF_STOCK:
                continue
            for brand in prod.brands:
                price = round(brand.base_price * store["factor"], 2)
                slug = prod.standard_name.lower().replace(" ", "+")
                # A realistic store listing title (name + brand + pack), as a
                # scraper would find it — exercises matching and pack parsing.
                title = f"{prod.standard_name} {brand.name}".replace("Genérico", "").strip()
                if pack > 1:
                    title = f"{title} {_PACK_LABEL[prod.id].format(n=pack)}".strip()
                offers.append(SeedOffer(
                    standard_name=prod.standard_name,
                    store_id=store["id"],
                    store_name=store["name"],
                    brand=brand.name,
                    price=price,
                    shipping=store["shipping"],
                    url=f'{store["base_url"]}/busca?q={slug}',
                    title=title,
                    ean=ean,
                    pack_qty=pack,
                    unit_price=round(price / pack, 2),
                ))
    return offers


def cheapest_brand(prod: ProductDef) -> Brand:
    return min(prod.brands, key=lambda b: b.base_price)
