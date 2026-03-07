#!/bin/bash
# Blog CMS Publisher — Test Scripts
# These simulate what the AI agent does. Run them to verify your CMS API is wired correctly.
#
# Setup: copy .env.example to .env and fill in your values, then:
#   source .env
#   bash test-scripts.sh

set -euo pipefail

echo "=== Blog CMS Publisher — API Tests ==="
echo ""

# ── 1. Submit a test draft ──────────────────────────────────────────────────
echo "1. Submitting test draft..."
RESPONSE=$(curl -s -X POST "${CMS_API_URL}/api/blog/draft" \
  -H "Authorization: Bearer ${CMS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Post from AI Agent",
    "slug": "test-post-ai-001",
    "excerpt": "A test draft submitted via the API.",
    "content": "## Hello\n\nThis is a test post submitted by the AI agent via the draft API.\n\nIt should appear in the admin dashboard as a draft with an AI badge.",
    "category_slug": "general",
    "tags": ["test", "ai-agent"],
    "drafted_by": "ai"
  }')
echo "$RESPONSE" | jq .
echo ""

# ── 2. Test bad auth (should fail with 401) ─────────────────────────────────
echo "2. Testing bad auth (expect 401)..."
curl -s -X POST "${CMS_API_URL}/api/blog/draft" \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"title":"x","slug":"x","content":"x"}' | jq .
echo ""

# ── 3. Test missing required fields (should fail with 400) ──────────────────
echo "3. Testing missing fields (expect 400)..."
curl -s -X POST "${CMS_API_URL}/api/blog/draft" \
  -H "Authorization: Bearer ${CMS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Missing slug and content"}' | jq .
echo ""

# ── 4. Check all drafts ─────────────────────────────────────────────────────
echo "4. Checking all current drafts..."
curl -s "${CMS_API_URL}/api/blog/posts?status=draft" \
  -H "Authorization: Bearer ${CMS_API_KEY}" | jq '.[] | {title, status, drafted_by, rejection_note}'
echo ""

# ── 5. Check for rejected drafts (the rejection loop) ───────────────────────
echo "5. Checking for rejected drafts..."
curl -s "${CMS_API_URL}/api/blog/posts?status=draft&has_rejection_note=true" \
  -H "Authorization: Bearer ${CMS_API_KEY}" | jq .
echo ""

# ── 6. Revise a rejected post ───────────────────────────────────────────────
# Uncomment and set POST_ID to test
# echo "6. Resubmitting revised post..."
# POST_ID="your-post-id-here"
# curl -s -X PATCH "${CMS_API_URL}/api/blog/posts/${POST_ID}" \
#   -H "Authorization: Bearer ${CMS_API_KEY}" \
#   -H "Content-Type: application/json" \
#   -d '{"content": "## Revised\n\nMuch better intro.", "rejection_note": null}' | jq .

echo "=== Done ==="
