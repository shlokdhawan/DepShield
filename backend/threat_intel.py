import os
import feedparser
import logging
from hf_ner import extract_security_entities
from rag_client import upsert_threat

logger = logging.getLogger(__name__)

# Default feeds to monitor
FEEDS = [
    "https://github.com/advisories.atom",
    # Add more security feeds here
]

def update_threat_intelligence():
    """
    Background job: Fetch security RSS feeds, run NER to extract entities,
    and populate the Pinecone RAG database.
    """
    logger.info("[DepShield] Refreshing threat intelligence from feeds...")
    
    threats_processed = 0
    
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                text = f"{entry.title}. {entry.get('summary', '')} {entry.get('content', [{}])[0].get('value', '')}"
                
                # Extract entities using NER
                entities = extract_security_entities(text)
                
                # Upsert into Pinecone for each extracted package
                for pkg in entities.get("packages", []):
                    pkg_lower = pkg.lower()
                    
                    try:
                        upsert_threat(
                            package=pkg_lower,
                            source=entry.link,
                            title=entry.title,
                            description=entry.title,
                            text=text,
                            cves=entities.get("cves", [])
                        )
                        threats_processed += 1
                    except Exception as e:
                        logger.error(f"[DepShield] Failed to upsert threat for {pkg_lower}: {e}")
                        
        except Exception as e:
            logger.error(f"[DepShield] Failed to fetch feed {url}: {e}")

    logger.info(f"[DepShield] Processed and upserted {threats_processed} threat intelligence records to Pinecone.")

