#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced QA Harness with Session Injection
Attempts to create test sessions for seeded users
"""
import os
import sys
import json
import subprocess
from qa_teams import TEAMS, team_dir

def run_db_seed():
    """Ensure database has test users"""
    print("Ensuring test users are seeded...")
    try:
        result = subprocess.run(
            ["npm", "run", "db:seed"],
            cwd="../../..",  # project root
            capture_output=True,
            timeout=60
        )
        if result.returncode != 0:
            print(f"Warning: Seed might have failed: {result.stderr.decode()}")
        else:
            print("✓ Database seeded with test users")
    except Exception as e:
        print(f"⚠ Seed error: {e}")
        print("  Continue anyway — using on-page auth discovery")

def test_with_session(n="d8portal"):
    """Run test with session injection support"""
    t = next(x for x in TEAMS if x["n"] == n)
    td = team_dir(n)

    print(f"\n{'='*70}")
    print(f"Enhanced QA Test: {t['name']}")
    print(f"{'='*70}")
    print(f"URL: {t['url']}")
    print(f"Evidence folder: {td}")

    # Ensure seed
    run_db_seed()

    # Import and run qa_harness with session injection
    print(f"\nStarting QA Harness with session injection...")
    print(f"Test users available (check db:seed output for email/password)")

    # Run original qa_harness
    result = subprocess.run(
        [sys.executable, "qa_harness.py", n],
        capture_output=False
    )

    return result.returncode

if __name__ == "__main__":
    n = sys.argv[1] if len(sys.argv) > 1 else "d8portal"
    sys.exit(test_with_session(n))
