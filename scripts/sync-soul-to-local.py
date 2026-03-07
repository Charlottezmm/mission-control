#!/usr/bin/env python3
"""Sync SOUL.md from Supabase memory_files → local OpenClaw workspace files."""

import json
import os
import urllib.request

SUPABASE_URL = "https://hkarpznjtrhehauvcphf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXJwem5qdHJoZWhhdXZjcGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwMDA2NCwiZXhwIjoyMDg4Mjc2MDY0fQ.C_le0bRcZyA-pFDV3SOq4PxsyGouiVE2dg_ugvRa-kQ"

AGENT_WORKSPACE_MAP = {
    "main": os.path.expanduser("~/.openclaw/workspace-main/SOUL.md"),
    "techlead": os.path.expanduser("~/.openclaw/workspace-techlead/SOUL.md"),
    "writer": os.path.expanduser("~/.openclaw/workspace-writer/SOUL.md"),
    "marketing": os.path.expanduser("~/.openclaw/workspace-marketing/SOUL.md"),
    "video": os.path.expanduser("~/.openclaw/workspace-video/SOUL.md"),
}

def fetch_all_souls():
    url = f"{SUPABASE_URL}/rest/v1/memory_files?path=like.soul/*&select=path,content,synced_at"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def sync():
    rows = fetch_all_souls()
    if not rows:
        print("No SOUL.md entries in Supabase. Nothing to sync.")
        return

    synced = 0
    for row in rows:
        agent_id = row["path"].replace("soul/", "")
        content = row.get("content", "")
        local_path = AGENT_WORKSPACE_MAP.get(agent_id)

        if not local_path:
            print(f"  ⚠️  Unknown agent '{agent_id}', skipping")
            continue

        if not content.strip():
            print(f"  ⚠️  Empty content for {agent_id}, skipping")
            continue

        # Compare with local
        try:
            with open(local_path, "r") as f:
                local_content = f.read()
            if local_content.strip() == content.strip():
                print(f"  ✅ {agent_id}: already in sync")
                continue
        except FileNotFoundError:
            pass

        # Write
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "w") as f:
            f.write(content)
        print(f"  📝 {agent_id}: synced → {local_path}")
        synced += 1

    print(f"\nDone. {synced} file(s) updated.")

if __name__ == "__main__":
    sync()
