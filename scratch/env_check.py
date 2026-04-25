import os
from dotenv import load_dotenv
load_dotenv()
print(f"GROQ_API_KEY exists: {bool(os.environ.get('GROQ_API_KEY'))}")
print(f"HF_TOKEN exists: {bool(os.environ.get('HF_TOKEN'))}")
print(f"PINECONE_API_KEY exists: {bool(os.environ.get('PINECONE_API_KEY'))}")
