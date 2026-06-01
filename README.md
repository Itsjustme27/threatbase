# 🏔️ HimalayaFeed

[![Update Feed](https://github.com/sujallamichhane18/himalayafeed/actions/workflows/update-feed.yml/badge.svg)](https://github.com/sujallamichhane18/himalayafeed/actions/workflows/update-feed.yml)
![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![No API Keys](https://img.shields.io/badge/API%20keys-none-brightgreen)
![No VPS](https://img.shields.io/badge/infrastructure-zero-brightgreen)

A **fully-automated malicious IP intelligence feed** that runs entirely on
**GitHub Actions** — no VPS, no cloud account, no API keys, no paid services.
Fork once, never touch again.

---

## 📋 Table of Contents

- [How It Works](#-how-it-works)
- [Feed Sources](#-feed-sources)
- [Output Files](#-output-files)
- [Fork & Deploy in 2 Minutes](#-fork--deploy-in-2-minutes)
- [Consuming the Feed](#-consuming-the-feed)
- [Firewall Integration Examples](#-firewall-integration-examples)
- [Customisation](#-customisation)
- [Project Structure](#-project-structure)
- [FAQ](#-faq)
- [License](#-license)

---

## ⚙️ How It Works

```
Every hour (GitHub Actions cron)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              update_feed.py                             │
│                                                         │
│  12 public feeds ──► ThreadPoolExecutor(8)              │
│       │              (concurrent downloads)             │
│       ▼                                                 │
│  Per-feed parsing:                                      │
│    • strip comments, blank lines                        │
│    • extract first token (handles IP:PORT, IP\tscore)   │
│    • skip CIDRs (/prefix notation)                      │
│    • validate IPv4 syntax                               │
│    • discard private/RFC-reserved ranges                │
│       │                                                 │
│       ▼                                                 │
│  Merge all feeds → deduplicate → track provenance       │
│       │                                                 │
│       ▼                                                 │
│  Write 4 output files                                   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
  git diff (staged) — empty?
    ├─ YES → skip commit (no noise)
    └─ NO  → git commit + push via GITHUB_TOKEN
```

**Key design decisions:**
- One feed failing never aborts the run — errors are logged and skipped.
- Each IP tracks which source(s) reported it, enabling confidence scoring.
- IPs are sorted numerically (not lexicographically) for clean, stable diffs.
- Compact JSON (no extra whitespace) keeps file sizes manageable at 100k+ IPs.

---

## 📡 Feed Sources

| Key | Source | Type |
|-----|--------|------|
| `feodo_tracker` | [abuse.ch Feodo Tracker](https://feodotracker.abuse.ch) | C2 infrastructure (Dridex, Emotet, TrickBot) |
| `ssl_blacklist` | [abuse.ch SSLBL](https://sslbl.abuse.ch) | Malicious SSL certificate holders |
| `threatfox` | [abuse.ch ThreatFox](https://threatfox.abuse.ch) | Malware C2 IOCs |
| `ipsum` | [stamparm/ipsum](https://github.com/stamparm/ipsum) | Aggregated multi-source threat score |
| `stamparm_blackbook` | [stamparm/blackbook](https://github.com/stamparm/blackbook) | Active C&C / botnet servers |
| `firehol_level1` | [FireHOL Level 1](https://github.com/firehol/blocklist-ipsets) | Highest-confidence blocklist (low FP rate) |
| `firehol_level2` | [FireHOL Level 2](https://github.com/firehol/blocklist-ipsets) | Broader coverage, still conservative |
| `cins_army` | [CINS Score](https://cinsscore.com) | Active attack sources |
| `emerging_threats` | [Emerging Threats](https://rules.emergingthreats.net) | Compromised / attacker IPs |
| `blocklist_de` | [blocklist.de](https://www.blocklist.de) | Honeypot-reported brute-force IPs |
| `binary_defense` | [Binary Defense](https://www.binarydefense.com) | Threat intelligence feed |
| `greensnow` | [GreenSnow](https://greensnow.co) | Bad-actor blocklist |

All feeds are **free, unauthenticated, and publicly accessible**.

---

## 📄 Output Files

All files are committed to the repository root and updated every hour.

### `malicious_ips.txt`
Plain text, one IPv4 per line, with a short comment header.
```
# HimalayaFeed — Threat Intelligence Feed — updated 2025-01-01T00:00:00Z
# Total unique IPs : 287,412
# Sources used     : 12
# Format           : one IPv4 address per line

1.0.0.1
1.2.3.4
...
```
**Best for:** `ipset`, `iptables`, `pf`, simple `grep` scripts.

---

### `malicious_ips.csv`
CSV with columns `ip`, `sources`, `source_count`.
```csv
ip,sources,source_count
1.2.3.4,feodo_tracker|ipsum,2
5.6.7.8,cins_army,1
```
**Best for:** SIEM ingestion, Splunk, Elastic, database imports.

---

### `threat_feed.json`
Compact JSON with a `metadata` block and a full `ips` array.
```json
{
  "metadata": { "last_updated": "...", "total_unique_ips": 287412, ... },
  "ips": [
    { "ip": "1.2.3.4", "sources": ["feodo_tracker", "ipsum"], "source_count": 2 }
  ]
}
```
**Best for:** API consumption, custom tooling, enrichment pipelines.

---

### `stats.json`
Pretty-printed statistics snapshot.
```json
{
  "last_updated": "2025-01-01T00:00:00Z",
  "total_unique_ips": 287412,
  "total_feeds_processed": 12,
  "total_feeds_failed": 0,
  "failed_feeds": [],
  "ips_per_source": { "blocklist_de": 52100, "firehol_level2": 45200, ... },
  "multi_source_ips": 12834
}
```
**Best for:** monitoring, dashboards, feed-health alerting.

---

## 🚀 Fork & Deploy in 2 Minutes

> **Total steps: 2. Total cost: $0. Infrastructure required: none.**

**Step 1** — Click **Fork** (top-right of this page).

**Step 2** — In your fork, go to **Settings → Actions → General** and confirm
*"Allow all actions and reusable workflows"* is selected. Save.

That's it. GitHub will automatically run the feed aggregator on the next
hour boundary and every hour thereafter. You can also trigger it manually:
**Actions → HimalayaFeed — Update Threat Intelligence Feed → Run workflow**.

> **Branch protection note:** If your default branch has required PR reviews,
> the bot cannot push directly. Either disable that rule for this repo or
> create a repository-scoped PAT, add it as a secret named `GH_PAT`, and
> change `GITHUB_TOKEN` to `${{ secrets.GH_PAT }}` in the workflow.

---

## 🌐 Consuming the Feed

### Raw file URLs

```
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.csv
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/threat_feed.json
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/stats.json
```

### Quick check with curl

```bash
# Count IPs in the current feed
curl -s https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt \
  | grep -cE '^[0-9]'

# Check last update time
curl -s https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/stats.json \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['last_updated'])"

# Look up whether a specific IP is in the feed
curl -s https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt \
  | grep -w "1.2.3.4"
```

---

## 🔥 Firewall Integration Examples

### Linux — ipset + iptables (recommended for high-volume blocking)

```bash
#!/usr/bin/env bash
# /usr/local/sbin/update-threat-blocklist.sh
# Run via cron every hour: 5 * * * * root /usr/local/sbin/update-threat-blocklist.sh

FEED_URL="https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt"
SETNAME="himalayafeed"

# Create set if it doesn't exist (hash:ip is ~4 MB for 100k IPs, lives in RAM)
ipset create "$SETNAME" hash:ip hashsize 131072 maxelem 524288 2>/dev/null

# Download, filter comments, build restore file, load atomically
TMP=$(mktemp)
curl -fsSL --connect-timeout 15 --max-time 60 "$FEED_URL" \
  | grep -E '^[0-9]' \
  | sed "s/^/add ${SETNAME} /" \
  > "$TMP"

# Flush old entries and restore new ones in one operation
{
  echo "flush $SETNAME"
  cat "$TMP"
} | ipset restore

rm -f "$TMP"

# Ensure the iptables rule exists (idempotent)
iptables -C INPUT  -m set --match-set "$SETNAME" src -j DROP 2>/dev/null \
  || iptables -I INPUT  -m set --match-set "$SETNAME" src -j DROP
iptables -C FORWARD -m set --match-set "$SETNAME" src -j DROP 2>/dev/null \
  || iptables -I FORWARD -m set --match-set "$SETNAME" src -j DROP

echo "Blocklist updated: $(ipset list $SETNAME | grep 'Number of entries' | awk '{print $NF}') IPs"
```

### Linux — nftables

```bash
# Create a named set and populate it
nft add table inet filter 2>/dev/null
nft add set inet filter himalayafeed "{ type ipv4_addr; flags dynamic,timeout; timeout 2h; }" 2>/dev/null

curl -fsSL https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt \
  | grep -E '^[0-9]' \
  | while read -r ip; do
      nft add element inet filter himalayafeed "{ $ip }"
    done

nft add chain inet filter input "{ type filter hook input priority 0; policy accept; }" 2>/dev/null
nft add rule  inet filter input ip saddr @himalayafeed drop
```

### BSD / pfSense / OPNsense — pf tables

```bash
# /etc/pf.conf snippet
table <himalayafeed> persist file "/etc/pf.himalayafeed.txt"
block in  quick from <himalayafeed>
block out quick to   <himalayafeed>
```

```bash
# Refresh script (run via cron)
curl -fsSL https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt \
  | grep -E '^[0-9]' > /etc/pf.himalayafeed.txt

pfctl -t himalayafeed -T replace -f /etc/pf.himalayafeed.txt
```

### Nginx — deny all feed IPs

```bash
# Generate nginx geo block from feed
curl -fsSL https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt \
  | grep -E '^[0-9]' \
  | sed 's/^/deny /; s/$/ ;/' \
  > /etc/nginx/conf.d/himalayafeed-deny.conf

nginx -t && nginx -s reload
```

### Python — check if an IP is in the feed

```python
import requests

FEED_URL = "https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt"

def load_blocklist() -> set[str]:
    resp = requests.get(FEED_URL, timeout=30)
    resp.raise_for_status()
    return {
        line.strip()
        for line in resp.text.splitlines()
        if line.strip() and not line.startswith("#")
    }

blocklist = load_blocklist()
print("1.2.3.4 blocked?", "1.2.3.4" in blocklist)
```

---

## 🛠️ Customisation

### Add a new feed

Open `update_feed.py` and add an entry to the `FEEDS` dict:

```python
FEEDS: Dict[str, str] = {
    # ... existing feeds ...
    "my_custom_feed": "https://example.com/my-malicious-ips.txt",
}
```

Any feed that returns plain text with one IP per line (or IP:port, or
IP<tab>score with comments starting with `#`) will work out of the box.

### Change the update frequency

Edit `.github/workflows/update-feed.yml`:

```yaml
schedule:
  - cron: '0 */6 * * *'   # Every 6 hours
  - cron: '0 0 * * *'     # Once a day at midnight UTC
```

### Run locally

```bash
git clone https://github.com/sujallamichhane18/himalayafeed
cd himalayafeed
pip install -r requirements.txt
python update_feed.py
# Output files written to the current directory
```

### Adjust retry/timeout behaviour

At the top of `update_feed.py`:

```python
REQUEST_TIMEOUT = 30   # seconds per request before giving up
MAX_RETRIES     = 3    # attempts before a feed is marked as failed
RETRY_DELAY     = 5    # seconds between retry attempts
MAX_WORKERS     = 8    # concurrent download threads
```

---

## 📁 Project Structure

```
.
├── update_feed.py              ← Main aggregator script
├── requirements.txt            ← pip dependencies (requests, pandas)
├── README.md                   ← This file
├── .github/
│   └── workflows/
│       └── update-feed.yml     ← GitHub Actions workflow (hourly cron)
│
│   ── Generated by the workflow (committed automatically) ──
├── malicious_ips.txt           ← Plain-text IP list (one per line)
├── malicious_ips.csv           ← CSV with source provenance
├── threat_feed.json            ← Full JSON feed with metadata
└── stats.json                  ← Feed statistics and health data
```

---

## ❓ FAQ

**Q: Will this cost anything?**
A: No. GitHub Actions gives every public repository 2,000 free minutes/month
for public repos (unlimited for private on the free tier for standard runners).
This workflow uses ~60 seconds per run × 720 runs/month ≈ 720 minutes — well
within the free tier.

**Q: Will the hourly push spam my commit history?**
A: Only if the feed actually changes. The workflow checks `git diff --staged`
and skips the commit entirely if nothing changed. In practice, expect 8–20
commits per day as upstream feeds refresh.

**Q: How many IPs can I expect?**
A: Typically 250,000–400,000 unique IPs, depending on upstream feed activity.
The `stats.json` file always shows the current count.

**Q: How stale can the feed get?**
A: At most ~1 hour, since it runs on the hour. The `last_updated` field in
`stats.json` and `threat_feed.json` tells you exactly when it last ran.

**Q: What if a feed URL goes down permanently?**
A: The script logs a warning, skips that feed, and continues. Update the URL
in `update_feed.py` or remove the entry from `FEEDS` if a source disappears.

**Q: Are private/internal IPs included?**
A: No. The script explicitly filters out all RFC 1918 private ranges, loopback,
link-local, CGNAT, documentation, multicast, and reserved ranges.

**Q: Can I use this commercially?**
A: The aggregation code is MIT-licensed (free for any use). Check each upstream
feed's own terms of service before using their data commercially.

---

## 📜 License

MIT — see [LICENSE](LICENSE). Upstream feed data is subject to each provider's
own terms of service.
