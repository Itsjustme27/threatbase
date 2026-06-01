<div align="center">
  <img src="img/himalayafeed.png" alt="HimalayaFeed Banner" width="100%">
</div>

# 🏔️ HimalayaFeed

[![Update Feed](https://github.com/sujallamichhane18/himalayafeed/actions/workflows/update-feed.yml/badge.svg)](https://github.com/sujallamichhane18/himalayafeed/actions/workflows/update-feed.yml)
![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![No API Keys](https://img.shields.io/badge/API%20keys-none-brightgreen)
![No VPS](https://img.shields.io/badge/infrastructure-zero-brightgreen)

A **fully-automated, simple malicious IP intelligence feed**. 

HimalayaFeed is designed for pure simplicity and effectiveness. It aggregates known malicious IPv4 addresses from reputable open-source intelligence (OSINT) feeds without any complex infrastructure requirements.

**No VPCs. No API Keys. No Paid Services. Just Simple Threat Intelligence.**

---

## ⚡ Why HimalayaFeed?

- **Zero Infrastructure:** Runs entirely on GitHub Actions. You don't need to spin up a VPS, manage servers, or deal with VPC networking.
- **Zero Cost:** Uses only free, public feeds and free GitHub Actions minutes.
- **Zero Friction:** Fork the repository once, and the feed updates automatically every hour.
- **Highly Compatible:** Outputs raw IPs, CSVs, and JSON files ready to be ingested by firewalls, SIEMs, or custom scripts.

---

## 📄 Available Feeds

All files are committed directly to this repository and updated automatically every hour. You can pull these directly into your security infrastructure:

### 1. Plain Text (Best for Firewalls & iptables)
`malicious_ips.txt` — One IPv4 address per line.
```
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt
```

### 2. CSV (Best for SIEMs & Databases)
`malicious_ips.csv` — Includes the IP, sources that reported it, and a confidence count.
```
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.csv
```

### 3. JSON (Best for APIs & Custom Tooling)
`threat_feed.json` — Compact JSON array with detailed metadata.
```
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/threat_feed.json
```

### 4. Feed Statistics
`stats.json` — Health metrics and unique IP counts for the latest run.
```
https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/stats.json
```

---

## 🚀 How to Run Your Own Instance

It takes less than 2 minutes to deploy your own private or public fork of HimalayaFeed:

1. **Fork this repository** to your own GitHub account.
2. Navigate to **Settings → Actions → General** in your fork.
3. Ensure that **"Allow all actions and reusable workflows"** is checked and save.

The GitHub Action will now automatically run every hour, gathering threat data and pushing it to your repository.

---

## 🛡️ Integration Examples

### Linux iptables / ipset
```bash
wget -qO- https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt | grep -E '^[0-9]' | while read IP; do
  iptables -I INPUT -s $IP -j DROP
done
```
*(Note: For high-volume blocking, using `ipset` is highly recommended over raw iptables rules).*

### NGINX Blocklist
```bash
curl -fsSL https://raw.githubusercontent.com/sujallamichhane18/himalayafeed/main/malicious_ips.txt \
  | grep -E '^[0-9]' | sed 's/^/deny /; s/$/ ;/' > /etc/nginx/conf.d/himalayafeed-deny.conf
nginx -s reload
```

---

## ⚖️ License

This project is licensed under the **MIT License**. Upstream feed data is subject to each respective provider's terms of service.
