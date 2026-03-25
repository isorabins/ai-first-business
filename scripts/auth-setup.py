#!/usr/bin/env python3
"""
Google Drive OAuth Setup

Run this once per Google account to create the token file that
file-summarizer.py uses to access your Drive.

Usage:
    python3 auth-setup.py                        # interactive setup
    python3 auth-setup.py --email me@gmail.com   # specify account upfront

Requirements:
    pip install google-auth google-auth-oauthlib google-api-python-client

Before running:
    1. Go to https://console.cloud.google.com
    2. Create a project (or use an existing one)
    3. Enable the Google Drive API
    4. Go to APIs & Services > Credentials
    5. Create OAuth 2.0 Client ID > Desktop app
    6. Download the JSON and save it as 'client-credentials.json'
       in the same folder as this script
"""

import json
import sys
import os
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
except ImportError:
    print("Missing dependencies. Run:")
    print("  pip install google-auth google-auth-oauthlib google-api-python-client")
    sys.exit(1)

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",  # optional, for email integration
]

TOKEN_DIR = Path("./tokens")
CREDENTIALS_FILE = Path("./client-credentials.json")


def setup_account(email=None):
    if not CREDENTIALS_FILE.exists():
        print(f"\n⚠️  client-credentials.json not found.")
        print(f"\nTo get it:")
        print(f"  1. Go to https://console.cloud.google.com")
        print(f"  2. Create or select a project")
        print(f"  3. Enable the Drive API: APIs & Services > Library > Google Drive API")
        print(f"  4. Create credentials: APIs & Services > Credentials > + Create Credentials > OAuth client ID")
        print(f"  5. Type: Desktop app")
        print(f"  6. Download the JSON and save as 'client-credentials.json' here")
        print(f"\nThen re-run this script.")
        sys.exit(1)

    if not email:
        print("\nGoogle Drive OAuth Setup")
        print("========================")
        print("This will open a browser window to authorize access to your Drive.")
        print("You'll need to do this once per Google account.\n")
        email = input("Enter the Google account email you want to authorize: ").strip()
        if not email:
            print("Email required.")
            sys.exit(1)

    # Sanitize email for filename
    token_filename = email.replace("@", "_at_").replace(".", "_") + ".json"
    token_path = TOKEN_DIR / token_filename

    if token_path.exists():
        print(f"\n✅ Token already exists: {token_path}")
        print(f"   Delete it and re-run to re-authorize.")
        return token_path

    print(f"\nAuthorizing {email}...")
    print("A browser window will open. Sign in with this account and click Allow.\n")

    flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
    creds = flow.run_local_server(port=0, open_browser=True)

    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
    }
    with open(token_path, "w") as f:
        json.dump(token_data, f, indent=2)

    print(f"\n✅ Token saved: {token_path}")
    print(f"\nNext step: add this account to file-summarizer.py:")
    print(f"""
ACCOUNTS = {{
    "my-account": {{
        "token": "{token_filename}",
        "email": "{email}",
        "label": "My Drive",
    }},
}}
""")
    return token_path


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Google Drive OAuth setup")
    parser.add_argument("--email", help="Google account email to authorize")
    args = parser.parse_args()

    setup_account(args.email)

    another = input("\nAuthorize another account? (y/N): ").strip().lower()
    if another == 'y':
        setup_account()


if __name__ == "__main__":
    main()
