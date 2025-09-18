"""
ingest.py
- Crawl & embed news articles
- Store embeddings + metadata into a Chroma vector DB
- Run a sample query
"""

import numpy as np
from pathlib import Path
from tqdm import tqdm
from newsplease import NewsPlease
import feedparser
from transformers import AutoTokenizer, AutoModel
import torch
import chromadb

# ---------- CONFIG ----------
RSS_FEEDS = [
   "http://feeds.bbci.co.uk/news/rss.xml",
    "http://rss.cnn.com/rss/edition.rss",
    "https://www.reutersagency.com/feed/?best-topics=top-news",
    "https://www.theguardian.com/world/rss",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
]
TARGET_NUM = 50
OUT_DIR = Path("news_output")
OUT_DIR.mkdir(exist_ok=True)

CHROMA_PATH = OUT_DIR / "chroma_db"   # <-- single source of truth

EMBED_MODEL = "jinaai/jina-embeddings-v2-base-en"
BATCH_SIZE = 8
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


# ---------- Gather URLs ----------
def gather_urls(feeds, max_items):
    urls, seen = [], set()
    for feed in feeds:
        d = feedparser.parse(feed)
        for e in d.entries:
            if len(urls) >= max_items:
                break
            url = e.get("link")
            if url and url not in seen:
                seen.add(url)
                urls.append(url)
        if len(urls) >= max_items:
            break
    print(f"✅ Collected {len(urls)} URLs")
    return urls


# ---------- Extract articles ----------
def fetch_articles(urls):
    articles = []
    for url in tqdm(urls, desc="Fetching articles"):
        try:
            art = NewsPlease.from_url(url)
            if not art:
                continue
            text = art.maintext or art.text or ""
            if len(text.strip()) < 200:
                continue
            articles.append(
                {
                    "id": url,
                    "url": url,
                    "title": art.title or "",
                    "text": text,
                    "date": art.date_publish.isoformat()
                    if getattr(art, "date_publish", None)
                    else None,
                    "source": getattr(art, "source_domain", None),
                }
            )
        except Exception as e:
            print(f"[WARN] failed {url}: {e}")
    print(f"✅ Got {len(articles)} usable articles")
    return articles


# ---------- Embedding ----------
def load_jina_model():
    tok = AutoTokenizer.from_pretrained(EMBED_MODEL, trust_remote_code=True)
    model = AutoModel.from_pretrained(EMBED_MODEL, trust_remote_code=True).to(DEVICE)
    model.eval()
    return tok, model


def embed_texts(texts, tok, model):
    embs = []
    with torch.no_grad():
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            enc = tok(
                batch,
                padding=True,
                truncation=True,
                return_tensors="pt",
                max_length=8192,
            )
            out = model(
                enc["input_ids"].to(DEVICE),
                attention_mask=enc["attention_mask"].to(DEVICE),
            )
            last_hidden = out.last_hidden_state
            mask = (
                enc["attention_mask"].unsqueeze(-1).expand(last_hidden.size()).float()
            )
            summed = (last_hidden * mask).sum(1)
            counts = mask.sum(1)
            mean_pooled = summed / counts.clamp(min=1e-9)
            normed = torch.nn.functional.normalize(mean_pooled, p=2, dim=1)
            embs.append(normed.cpu().numpy())
    return np.vstack(embs)


# ---------- Store in Chroma ----------
def store_in_chroma(articles, embeddings):
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = client.get_or_create_collection(name="news_articles")

    ids = [a["id"] for a in articles]
    docs = [a["text"] for a in articles]
    metas = [
        {
            "title": a["title"],
            "url": a["url"],
            "date": a["date"],
            "source": a["source"],
        }
        for a in articles
    ]

    collection.add(
        ids=ids,
        documents=docs,
        embeddings=embeddings.tolist(),
        metadatas=metas,
    )

    print(f"✅ Inserted {len(ids)} docs into Chroma collection '{collection.name}'")


# ---------- Query Example ----------
def query_example(tok, model):
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    col = client.get_or_create_collection("news_articles")  # safer

    query = "climate change summit"
    enc = tok([query], padding=True, truncation=True, return_tensors="pt", max_length=8192)
    with torch.no_grad():
        out = model(
            enc["input_ids"].to(DEVICE),
            attention_mask=enc["attention_mask"].to(DEVICE),
        )
        last_hidden = out.last_hidden_state
        mask = enc["attention_mask"].unsqueeze(-1).expand(last_hidden.size()).float()
        summed = (last_hidden * mask).sum(1)
        counts = mask.sum(1)
        mean_pooled = summed / counts.clamp(min=1e-9)
        query_emb = torch.nn.functional.normalize(mean_pooled, p=2, dim=1).cpu().numpy()

    q = col.query(query_embeddings=query_emb.tolist(), n_results=3)
    print("🔍 Query results:", q)


# ---------- Main ----------
def main():
    urls = gather_urls(RSS_FEEDS, TARGET_NUM * 2)[:TARGET_NUM]
    articles = fetch_articles(urls)

    tok, model = load_jina_model()
    embeddings = embed_texts([a["text"] for a in articles], tok, model)

    store_in_chroma(articles, embeddings)

    query_example(tok, model)


if __name__ == "__main__":
    main()
