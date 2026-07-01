import os
import sys
import subprocess
import time
import argparse
import json
import yaml
import psycopg2
import requests
from datetime import datetime
from dotenv import load_dotenv

# Configure console output encoding for Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Load configurations
load_dotenv(".env")
load_dotenv(".env.local")


DATABASE_URL = os.getenv("DATABASE_URL")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is missing.")
    return psycopg2.connect(DATABASE_URL)

def run_cli_command(command_list):
    """Executes a CLI command and returns the output."""
    try:
        # Prepend powershell or cmd prefixes if running on Windows
        # Since we verified 'opencli' and 'twitter' commands run directly in shell:
        result = subprocess.run(
            command_list,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=60
        )
        if result.returncode != 0:
            print(f"CLI Error running {' '.join(command_list)}: {result.stderr}")
            return None
        return result.stdout
    except Exception as e:
        print(f"Exception running CLI command {' '.join(command_list)}: {e}")
        return None

def scrape_reddit(keyword):
    """Scrapes Reddit posts using opencli."""
    print(f"Scraping Reddit for keyword: '{keyword}'...")
    stdout = run_cli_command(["opencli", "reddit", "search", f'"{keyword}"', "-f", "yaml"])
    if not stdout:
        return []
    
    try:
        posts = yaml.safe_load(stdout)
        if not posts or not isinstance(posts, list):
            return []
        
        parsed_posts = []
        for post in posts:
            created_at = None
            if post.get("created_utc"):
                try:
                    created_at = datetime.utcfromtimestamp(int(post["created_utc"]))
                except Exception:
                    pass
            
            parsed_posts.append({
                "external_id": str(post.get("id")),
                "title": post.get("title", ""),
                "content": post.get("selftext", "") or post.get("title", ""),
                "author": post.get("author", "anonymous"),
                "url": post.get("url", ""),
                "post_created_at": created_at
            })
        return parsed_posts
    except Exception as e:
        print(f"Error parsing Reddit YAML: {e}")
        return []

def scrape_twitter(keyword):
    """Scrapes Twitter/X posts using twitter-cli."""
    print(f"Scraping Twitter/X for keyword: '{keyword}'...")
    stdout = run_cli_command(["twitter", "search", f'"{keyword}"', "-n", "10"])
    if not stdout:
        return []
    
    try:
        data = yaml.safe_load(stdout)
        if not data or not isinstance(data, dict) or "data" not in data:
            return []
        
        tweets = data["data"]
        parsed_posts = []
        for tweet in tweets:
            created_at = None
            if tweet.get("createdAtISO"):
                try:
                    # ISO string parsing
                    created_at = datetime.fromisoformat(tweet["createdAtISO"].replace("Z", "+00:00"))
                except Exception:
                    pass
            
            author_data = tweet.get("author", {})
            screen_name = author_data.get("screenName", "unknown")
            author_name = author_data.get("name", "unknown")
            
            parsed_posts.append({
                "external_id": str(tweet.get("id")),
                "title": f"Tweet by @{screen_name} ({author_name})",
                "content": tweet.get("text", ""),
                "author": screen_name,
                "url": f"https://x.com/{screen_name}/status/{tweet.get('id')}",
                "post_created_at": created_at
            })
        return parsed_posts
    except Exception as e:
        print(f"Error parsing Twitter YAML: {e}")
        return []

def analyze_post_with_ai(title, content, keyword):
    """Analyzes a post's buying intent and drafts a response using Gemini/OpenRouter."""
    if not OPENROUTER_API_KEY:
        print("Warning: OPENROUTER_API_KEY is not configured. Skipping AI analysis.")
        return 0, "No API key", ""

    prompt = f"""
You are an expert sales intelligence assistant for LeadScout.ai.
Analyze this social media post for buying intent or relevant interest in: "{keyword}".

Post Title: {title}
Post Content: {content}

Instructions:
1. Rate the buying intent score from 0 to 100:
   - 80-100: High intent (actively looking to buy a solution, asking for recommendation, has budget).
   - 40-79: Medium intent (complaining about a pain point that a product can solve, seeking advice).
   - 0-39: Low intent (general article, discussion, unrelated spam).
2. Write a 1-2 sentence explanation of your reasoning.
3. Draft a helpful, personalized response that adds value first and softly suggests a solution. Avoid pushy sales pitches or sounding like spam.

Return ONLY a JSON object with this format:
{{
  "intent_score": <0-100>,
  "reasoning": "<explanation>",
  "draft_reply": "<reply>"
}}
"""
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://leadscout.ai",
        "X-Title": "LeadScout.ai Scraper"
    }
    
    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"}
    }
    
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        res_json = response.json()
        content_text = res_json["choices"][0]["message"]["content"].strip()
        parsed = json.loads(content_text)
        return (
            int(parsed.get("intent_score", 0)),
            parsed.get("reasoning", ""),
            parsed.get("draft_reply", "")
        )
    except Exception as e:
        print(f"Error parsing AI response for '{keyword}': {e}")
        return 0, f"Error: {e}", ""

def process_keywords():
    """Main processing loop for keywords and scraping."""
    print(f"Starting lead qualification cycle: {datetime.now()}")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return

    try:
        # Fetch keywords
        cur.execute("SELECT id, user_id, keyword, platforms FROM public.monitored_keywords;")
        keywords = cur.fetchall()
        print(f"Found {len(keywords)} active keyword(s) to monitor.")
        
        for k_id, user_id, keyword, platforms in keywords:
            posts = []
            if "reddit" in platforms:
                posts.extend(scrape_reddit(keyword))
            if "twitter" in platforms or "x" in platforms:
                posts.extend(scrape_twitter(keyword))
            
            print(f"Scraped {len(posts)} total raw posts for keyword '{keyword}'.")
            
            for post in posts:
                # 1. Check if post already exists
                cur.execute(
                    "SELECT id FROM public.scraped_posts WHERE platform = %s AND external_id = %s;",
                    (post["post_created_at"] is not None and "twitter" or "reddit", post["external_id"])
                )
                db_post = cur.fetchone()
                
                platform = "twitter" if "x.com" in post["url"] else "reddit"
                
                if db_post:
                    post_id = db_post[0]
                else:
                    # 2. Insert into scraped_posts
                    cur.execute(
                        """
                        INSERT INTO public.scraped_posts (platform, external_id, title, content, author, url, post_created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id;
                        """,
                        (platform, post["external_id"], post["title"], post["content"], post["author"], post["url"], post["post_created_at"])
                    )
                    post_id = cur.fetchone()[0]
                    conn.commit()
                
                # 3. Check if lead already processed for this user/keyword
                cur.execute(
                    "SELECT id FROM public.leads WHERE user_id = %s AND keyword_id = %s AND post_id = %s;",
                    (user_id, k_id, post_id)
                )
                if cur.fetchone():
                    continue # Already processed
                
                # 4. Analyze intent using Gemini AI
                intent_score, reasoning, draft_reply = analyze_post_with_ai(
                    post["title"], post["content"], keyword
                )
                
                # 5. Insert into leads (only if intent is interesting, e.g. score >= 40)
                if intent_score >= 40:
                    print(f"Qualified Lead found! Intent: {intent_score}/100. Post: {post['url']}")
                    cur.execute(
                        """
                        INSERT INTO public.leads (user_id, keyword_id, post_id, intent_score, reasoning, draft_reply, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """,
                        (user_id, k_id, post_id, intent_score, reasoning, draft_reply, "new")
                    )
                    conn.commit()
                else:
                    # Save a log of low intent leads or ignore
                    pass
        
        print("Cycle completed successfully.")
    except Exception as e:
        print(f"Error during processing: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="LeadScout.ai Scraper Worker Daemon")
    parser.add_argument("--run-once", action="store_true", help="Run once and exit")
    parser.add_argument("--daemon", action="store_true", help="Run continuously every hour")
    parser.add_argument("--test", type=str, help="Run a test scrape cycle for a single keyword and output to console")
    
    args = parser.parse_args()
    
    if args.test:
        print(f"--- Running Test Scrape for Keyword: '{args.test}' ---")
        reddit_posts = scrape_reddit(args.test)
        twitter_posts = scrape_twitter(args.test)
        all_posts = reddit_posts + twitter_posts
        print(f"Scraped {len(all_posts)} posts.")
        for idx, p in enumerate(all_posts[:3]):
            print(f"\n[{idx+1}] Title: {p['title']}")
            print(f"URL: {p['url']}")
            print(f"Content Summary: {p['content'][:100]}...")
            score, reason, draft = analyze_post_with_ai(p["title"], p["content"], args.test)
            print(f"Intent Score: {score}/100")
            print(f"Reasoning: {reason}")
            print(f"Draft: {draft}")
        return

    if args.daemon:
        print("Running in daemon mode. Scrapes every hour...")
        while True:
            process_keywords()
            time.sleep(3600)
    else:
        # Default is run-once
        process_keywords()

if __name__ == "__main__":
    main()
