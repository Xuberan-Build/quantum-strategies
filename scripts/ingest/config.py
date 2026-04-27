import os
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

_base = os.path.join(os.path.dirname(__file__), "../..")
load_dotenv(dotenv_path=os.path.join(_base, ".env.local"), override=False)
load_dotenv(dotenv_path=os.path.join(_base, ".env"), override=False)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIMENSIONS = 1536
EMBED_BATCH_SIZE = 100   # chunks per OpenAI embedding request
CHUNK_SIZE = 512         # max tokens (approximate via char count * 0.75)
CHUNK_OVERLAP = 64

# Approximate max chars before we force-split (512 tokens ≈ 2048 chars)
MAX_CHARS = 2048

SCRAPE_DELAY = 1.5       # seconds between HTTP requests

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
