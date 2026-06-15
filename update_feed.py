#!/usr/bin/env python3
"""
Threatbase — Threat Intelligence Feed Aggregator (v4)
=====================================================
Collects malicious IPv4 addresses, Domains, Hashes, and URLs from public feeds.
Highly optimized: fully asynchronous I/O with streaming, C-level fast IP validation.
Outputs CSV, JSON, TXT, and automatically uploads to Supabase S3 storage.
"""

import asyncio
import bisect
import io
import json
import logging
import os
import re
import socket
import sys
import time
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

import aiohttp
import boto3
from botocore.client import Config
import ipaddress

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Feed definitions
# ─────────────────────────────────────────────────────────────────────────────
FEEDS: Dict[str, str] = {
    "feodo_tracker": "https://feodotracker.abuse.ch/downloads/ipblocklist.txt",
    "feodo_tracker_aggressive": "https://feodotracker.abuse.ch/downloads/ipblocklist_aggressive.txt",
    "bbcan177_ms1": "https://gist.githubusercontent.com/BBcan177/bf29d47ea04391cb3eb0/raw/",
    "ipsum": "https://raw.githubusercontent.com/stamparm/ipsum/master/levels/1.txt",
    "ipsum_level2": "https://raw.githubusercontent.com/stamparm/ipsum/master/levels/2.txt",
    "ipsum_level3": "https://raw.githubusercontent.com/stamparm/ipsum/master/levels/3.txt",
    "ipsum_level4": "https://raw.githubusercontent.com/stamparm/ipsum/master/levels/4.txt",
    "ipsum_level5": "https://raw.githubusercontent.com/stamparm/ipsum/master/levels/5.txt",
    "blackbook": "https://raw.githubusercontent.com/stamparm/blackbook/master/blackbook.txt",
    "firehol_level1": "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset",
    "firehol_level2": "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level2.netset",
    "cins_army": "https://cinsscore.com/list/ci-badguys.txt",
    "emerging_threats": "https://rules.emergingthreats.net/blockrules/compromised-ips.txt",
    "emerging_threats_fwrules": "https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt",
    "blocklist_de": "https://lists.blocklist.de/lists/all.txt",
    "blocklist_de_ssh": "https://lists.blocklist.de/lists/ssh.txt",
    "blocklist_de_mail": "https://lists.blocklist.de/lists/mail.txt",
    "blocklist_de_apache": "https://lists.blocklist.de/lists/apache.txt",
    "binary_defense": "https://www.binarydefense.com/banlist.txt",
    "greensnow": "https://blocklist.greensnow.co/greensnow.txt",
    "spamhaus_drop": "https://www.spamhaus.org/drop/drop.txt",
    "spamhaus_edrop": "https://www.spamhaus.org/drop/edrop.txt",
    "dshield_blocklist": "https://feeds.dshield.org/block.txt",
    "criticalpath_security": "https://raw.githubusercontent.com/CriticalPathSecurity/Public-Intelligence-Feeds/master/compromised-ips.txt",
    "bruteforceblocker": "https://danger.rulez.sk/projects/bruteforceblocker/blist.php",
    "botvrij": "https://www.botvrij.eu/data/misp.text_ip-dst.ADMIN.txt",
    "dan_tor": "https://www.dan.me.uk/torlist/?full",
    "tor_bulk_exit": "https://check.torproject.org/torbulkexitlist",
    "romainmarcoux_outgoing_40k": "https://raw.githubusercontent.com/romainmarcoux/malicious-outgoing-ip/main/full-outgoing-ip-40k.txt",
    "romainmarcoux_outgoing_aa": "https://raw.githubusercontent.com/romainmarcoux/malicious-outgoing-ip/main/full-outgoing-ip-aa.txt",
    "romainmarcoux_outgoing_ab": "https://raw.githubusercontent.com/romainmarcoux/malicious-outgoing-ip/main/full-outgoing-ip-ab.txt",
    "alienvault_reputation": "https://reputation.alienvault.com/reputation.generic",
    "talos_intel": "https://talosintelligence.com/documents/ip-blacklist",
    "sslbl_abuse_ch": "https://sslbl.abuse.ch/blacklist/sslipblacklist.txt",
    "osint_bambenek_c2": "https://osint.bambenekconsulting.com/feeds/c2-ipmasterlist.txt",
    "stopforumspam_toxic": "https://www.stopforumspam.com/downloads/toxic_ip_cidr.txt",
    "firehol_level3": "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level3.netset",
    "firehol_level4": "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level4.netset",
    "blocklist_net_bots": "https://lists.blocklist.de/lists/bots.txt",
    "blocklist_net_strongips": "https://lists.blocklist.de/lists/strongips.txt",
    "snort_ip_filter": "https://snort.org/downloads/ip-block-list",
    "dataplane_sipinv": "https://dataplane.org/sipinvitation.txt",
    "dataplane_sshclient": "https://dataplane.org/sshclient.txt",
    "dataplane_sshpwauth": "https://dataplane.org/sshpwauth.txt",
    "dataplane_vnclogin": "https://dataplane.org/vnclogin.txt",
}

FEED_CATEGORIES: Dict[str, str] = {
    "feodo_tracker": "C2",
    "feodo_tracker_aggressive": "C2",
    "bbcan177_ms1": "Malware",
    "ipsum": "Mixed",
    "ipsum_level2": "Mixed",
    "ipsum_level3": "Mixed",
    "ipsum_level4": "Mixed",
    "ipsum_level5": "Mixed",
    "blackbook": "Mixed",
    "firehol_level1": "Mixed",
    "firehol_level2": "Mixed",
    "cins_army": "Compromised",
    "emerging_threats": "Compromised",
    "emerging_threats_fwrules": "Malicious",
    "blocklist_de": "Brute-Force",
    "blocklist_de_ssh": "Brute-Force",
    "blocklist_de_mail": "Spam",
    "blocklist_de_apache": "Exploit",
    "binary_defense": "Mixed",
    "greensnow": "Brute-Force",
    "spamhaus_drop": "Spam",
    "dshield_blocklist": "Malware",
    "criticalpath_security": "Compromised",
    "abuseipdb": "Malicious",
    "bruteforceblocker": "Brute-Force",
    "botvrij": "Mixed",
    "threatfox_recent": "Mixed",
    "dan_tor": "Tor",
    "tor_bulk_exit": "Tor",
    "romainmarcoux_outgoing_40k": "Malicious",
    "romainmarcoux_outgoing_aa": "Malicious",
    "romainmarcoux_outgoing_ab": "Malicious",
    "alienvault_reputation": "Malicious",
    "talos_intel": "Malicious",
    "sslbl_abuse_ch": "C2",
    "osint_bambenek_c2": "C2",
    "stopforumspam_toxic": "Spam",
    "firehol_level3": "Mixed",
    "firehol_level4": "Mixed",
    "blocklist_net_bots": "Botnet",
    "blocklist_net_strongips": "Brute-Force",
    "snort_ip_filter": "Malicious",
    "dataplane_sipinv": "Scanner",
    "dataplane_sshclient": "Scanner",
    "dataplane_sshpwauth": "Brute-Force",
    "dataplane_vnclogin": "Brute-Force",
}

DOMAIN_FEEDS: Dict[str, str] = {
    "openphish": "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
    "urlhaus": "https://urlhaus.abuse.ch/downloads/text_online/",
    "romainmarcoux": "https://raw.githubusercontent.com/romainmarcoux/malicious-domains/refs/heads/main/full-domains-aa.txt",
    "hagezi_ultimate": "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/ultimate.txt",
    "stevenblack_hosts": "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    "blocklist_malware": "https://blocklistproject.github.io/Lists/malware.txt",
    "blocklist_torrent": "https://blocklistproject.github.io/Lists/torrent.txt",
    "blocklist_fraud": "https://blocklistproject.github.io/Lists/fraud.txt",
    "blocklist_phishing": "https://blocklistproject.github.io/Lists/phishing.txt",
}

HASH_FEEDS: Dict[str, str] = {
    "malwarebazaar_recent": "https://bazaar.abuse.ch/export/txt/sha256/recent/",
    "malwarebazaar_full": "https://bazaar.abuse.ch/export/txt/sha256/full/",
}

URL_FEEDS: Dict[str, str] = {
    "urlhaus_online": "https://urlhaus.abuse.ch/downloads/text_online/",
    "urlhaus_recent": "https://urlhaus.abuse.ch/downloads/csv_recent/",
    "openphish_urls": "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
}

THREATFOX_FEEDS: Dict[str, str] = {
    "threatfox_recent": "https://threatfox.abuse.ch/export/json/recent/",
}

ABUSEIPDB_API_KEY: Optional[str] = os.environ.get("ABUSEIPDB_API_KEY")
if ABUSEIPDB_API_KEY:
    FEEDS["abuseipdb"] = "https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=70"

# ─────────────────────────────────────────────────────────────────────────────
# Regex & Whitelist setup
# ─────────────────────────────────────────────────────────────────────────────
_DOMAIN_PATTERN = re.compile(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$")
_SHA256_PATTERN = re.compile(r'^[a-fA-F0-9]{64}$')
_MD5_PATTERN = re.compile(r'^[a-fA-F0-9]{32}$')
_HASH_PATTERN = re.compile(r'^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$')
_URL_PATTERN = re.compile(r'^https?://.+')

_WHITELIST_CIDRS = [
    "1.0.0.0/24",       "1.1.1.0/24",       "8.8.8.0/24",       "8.8.4.0/24",
    "9.9.9.0/24",       "9.9.9.10/32",      "149.112.112.0/24", "208.67.222.0/24",
    "208.67.220.0/24",  "4.4.4.4/32",       "4.2.2.0/24",       "94.140.14.0/24",
    "94.140.15.0/24",   "192.195.233.204/32"
]

_WHITELIST_INT_RANGES = []
for cidr in _WHITELIST_CIDRS:
    net = ipaddress.ip_network(cidr)
    _WHITELIST_INT_RANGES.append((int(net.network_address), int(net.broadcast_address)))

_PRIVATE_RANGES = [
    (167772160, 184549375),       # 10.0.0.0/8
    (2886729728, 2887778303),     # 172.16.0.0/12
    (3232235520, 3232301055),     # 192.168.0.0/16
    (2130706432, 2147483647),     # 127.0.0.0/8
    (2851995648, 2852061183),     # 169.254.0.0/16
    (3758096384, 4026531839),     # 224.0.0.0/4
    (4026531840, 4294967295),     # 240.0.0.0/4
    (0, 16777215),                # 0.0.0.0/8
    (1681915904, 1686110207),     # 100.64.0.0/10
]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def is_valid_ipv4_fast(ip_str: str) -> Optional[int]:
    """C-based fast validation returning 32-bit integer."""
    try:
        packed = socket.inet_pton(socket.AF_INET, ip_str)
        ip_int = int.from_bytes(packed, 'big')
        
        for start, end in _PRIVATE_RANGES:
            if start <= ip_int <= end:
                return None
        
        for start, end in _WHITELIST_INT_RANGES:
            if start <= ip_int <= end:
                return None
                
        return ip_int
    except OSError:
        return None


def int_to_ip(ip_int: int) -> str:
    """Convert 32-bit int back to IP string."""
    return socket.inet_ntop(socket.AF_INET, ip_int.to_bytes(4, 'big'))


def is_valid_ipv6(ip: str) -> bool:
    if ":" not in ip: return False
    try:
        packed = socket.inet_pton(socket.AF_INET6, ip)
        # We skip deep private checks for IPv6 for speed, mostly ensuring syntactic validity
        return True
    except OSError:
        return False


def extract_domain(text: str) -> Optional[str]:
    text = text.strip()
    if text.startswith("http://") or text.startswith("https://"):
        try:
            text = text.split("://", 1)[1].split("/", 1)[0].split(":", 1)[0]
        except Exception: pass
    text = text.lower()
    if _DOMAIN_PATTERN.match(text):
        return text
    return None

def load_false_positives(filename="ioc/false_positives.txt") -> set:
    result = set()
    if os.path.exists(filename):
        try:
            with open(filename, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith(('#', '//')):
                        result.add(line)
            log.info(f"Loaded {len(result)} false positives")
        except Exception as e:
            log.error(f"Failed to load {filename}: {e}")
    return result

# ─────────────────────────────────────────────────────────────────────────────
# Async Fetchers
# ─────────────────────────────────────────────────────────────────────────────
async def fetch_feed_async(session: aiohttp.ClientSession, name: str, url: str) -> dict:
    headers = {"User-Agent": "Threatbase-Aggregator/4.0"}
    
    if name == "abuseipdb":
        if ABUSEIPDB_API_KEY:
            headers["Key"] = ABUSEIPDB_API_KEY
            headers["Accept"] = "application/json"
        else:
            return {'ipv4': set(), 'ipv6': set(), 'cidrs': set()}
            
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=45)) as r:
            if r.status != 200:
                log.error(f"  ✗ Feed {name} failed: HTTP {r.status}")
                return {}

            if name == "abuseipdb":
                data = await r.json()
                ips = set()
                for d in data.get("data", []):
                    ip_int = is_valid_ipv4_fast(d["ipAddress"])
                    if ip_int: ips.add(ip_int)
                log.info(f"  ✓ {name}: {len(ips)} IPs")
                return {'ipv4': ips, 'ipv6': set(), 'cidrs': set()}

            ips = set()
            ipv6s = set()
            cidrs = set()
            raw_lines = 0
            
            async for line_bytes in r.content:
                line = line_bytes.decode('utf-8', errors='ignore').strip()
                if not line or line.startswith(("#", "//", "!", "/*")):
                    continue
                raw_lines += 1
                
                parts = line.split()
                if not parts: continue
                token = parts[0].split(",")[0].strip("\"';")

                if "/" in token:
                    try:
                        network = ipaddress.ip_network(token, strict=False)
                        if network.version == 4 and network.prefixlen == 32:
                            ip_int = is_valid_ipv4_fast(str(network.network_address))
                            if ip_int: ips.add(ip_int)
                    except ValueError: pass
                else:
                    ip_int = is_valid_ipv4_fast(token)
                    if ip_int:
                        ips.add(ip_int)
                    elif is_valid_ipv6(token):
                        ipv6s.add(token)

            if name == "greensnow":
                log.info(f"  ✓ {name}: {len(ips)} IPs (Removed duplicates from source)")
            else:
                log.info(f"  ✓ {name}: {len(ips)} IPs")
            return {'ipv4': ips, 'ipv6': ipv6s, 'cidrs': cidrs}
    except Exception as e:
        log.error(f"  ✗ Feed {name} failed: {e}")
        return {}


async def fetch_domain_feed_async(session: aiohttp.ClientSession, name: str, url: str) -> Set[str]:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=45),
                               headers={"User-Agent": "Threatbase-Aggregator/4.0"}) as r:
            if r.status != 200: return set()
            domains = set()
            async for line_bytes in r.content:
                line = line_bytes.decode('utf-8', errors='ignore').strip()
                if not line or line.startswith(("#", "//")): continue
                if line.startswith('"'):
                    parts = line.split('","')
                    if len(parts) > 2:
                        domain = extract_domain(parts[2])
                        if domain: domains.add(domain)
                else:
                    candidate = line
                    if candidate.startswith("0.0.0.0 ") or candidate.startswith("127.0.0.1 "):
                        candidate = candidate.split(maxsplit=1)[1]
                    domain = extract_domain(candidate)
                    if domain: domains.add(domain)
            log.info(f"  ✓ {name}: {len(domains)} domains")
            return domains
    except Exception as e:
        log.error(f"  ✗ Domain feed {name} failed: {e}")
        return set()


async def fetch_hash_feed_async(session: aiohttp.ClientSession, name: str, url: str) -> Set[str]:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=90),
                               headers={"User-Agent": "Threatbase-Aggregator/4.0"}) as r:
            if r.status != 200: return set()
            hashes = set()
            
            content_type = r.headers.get('Content-Type', '')
            if 'application/zip' in content_type or url.endswith('.zip'):
                content = await r.read()
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    for filename in z.namelist():
                        if filename.endswith('.txt') or filename.endswith('.csv'):
                            with z.open(filename) as f:
                                for line_bytes in f:
                                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                                    if not line or line.startswith(('#', '//', '"')): continue
                                    token = line.split()[0].split(',')[0].strip('"\';\r\n')
                                    if _SHA256_PATTERN.match(token):
                                        hashes.add(token.lower())
            else:
                async for line_bytes in r.content:
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    if not line or line.startswith(('#', '//', '"')): continue
                    token = line.split()[0].split(',')[0].strip('"\';\r\n')
                    if _SHA256_PATTERN.match(token):
                        hashes.add(token.lower())
                        
            log.info(f"  ✓ {name}: {len(hashes)} hashes")
            return hashes
    except Exception as e:
        log.error(f"  ✗ Hash feed {name} failed: {e}")
        return set()


async def fetch_url_feed_async(session: aiohttp.ClientSession, name: str, url: str) -> Set[str]:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=45),
                               headers={"User-Agent": "Threatbase-Aggregator/4.0"}) as r:
            if r.status != 200: return set()
            urls = set()
            async for line_bytes in r.content:
                line = line_bytes.decode('utf-8', errors='ignore').strip()
                if not line or line.startswith(('#', '//')): continue
                if line.startswith('"'):
                    parts = line.split('","')
                    if len(parts) > 2:
                        candidate = parts[2].strip('"')
                        if _URL_PATTERN.match(candidate): urls.add(candidate)
                elif _URL_PATTERN.match(line):
                    urls.add(line)
            log.info(f"  ✓ {name}: {len(urls)} URLs")
            return urls
    except Exception as e:
        log.error(f"  ✗ URL feed {name} failed: {e}")
        return set()


async def fetch_threatfox_async(session: aiohttp.ClientSession, name: str, url: str) -> dict:
    result = {"ips": set(), "ipv6": set(), "cidrs": set(), "domains": set(), "hashes": set(), "urls": set()}
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=60),
                               headers={"User-Agent": "Threatbase-Aggregator/4.0"}) as r:
            if r.status != 200: return result
            data = await r.json()
            entries = data.get("data", data)
            if isinstance(entries, dict): entries = list(entries.values())
            
            flat = []
            if isinstance(entries, list):
                for item in entries:
                    if isinstance(item, list): flat.extend(item)
                    elif isinstance(item, dict): flat.append(item)
                    
            for entry in flat:
                if not isinstance(entry, dict): continue
                ioc = entry.get("ioc_value", "").strip()
                ioc_type = entry.get("ioc_type", "").lower()
                if not ioc: continue
                
                if "ip" in ioc_type:
                    ip_part = ioc.split(":")[0]
                    ip_int = is_valid_ipv4_fast(ip_part)
                    if ip_int: result["ips"].add(ip_int)
                elif "domain" in ioc_type:
                    d = extract_domain(ioc)
                    if d: result["domains"].add(d)
                elif "sha256" in ioc_type and _SHA256_PATTERN.match(ioc):
                    result["hashes"].add(ioc.lower())
                elif "url" in ioc_type and _URL_PATTERN.match(ioc):
                    result["urls"].add(ioc)
            log.info(f"  ✓ ThreatFox {name}: {len(result['ips'])} IPs")
            return result
    except Exception as e:
        log.error(f"  ✗ ThreatFox {name} failed: {e}")
        return result


# ─────────────────────────────────────────────────────────────────────────────
# Uploads
# ─────────────────────────────────────────────────────────────────────────────
def upload_to_supabase(file_path: str, object_name: str):
    access_key = os.environ.get("SUPABASE_S3_ACCESS_KEY")
    secret_key = os.environ.get("SUPABASE_S3_SECRET_KEY")
    bucket_name = "threatbase-ioc"
    endpoint_url = "https://fybwjibrvwqwnspgswtp.storage.supabase.co/storage/v1/s3"
    
    if not access_key or not secret_key:
        log.warning(f"Supabase S3 credentials not found. Skipping upload for {file_path}")
        return
        
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name='us-east-1',
            config=Config(signature_version='s3v4')
        )
        
        log.info(f"  ☁ Uploading {file_path} to Supabase bucket '{bucket_name}'...")
        s3.upload_file(file_path, bucket_name, object_name)
        log.info(f"  ✓ Successfully uploaded {object_name}.")
    except Exception as e:
        log.error(f"  ✗ Failed to upload {file_path} to Supabase: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Trust Tier & Tag Processing
# ─────────────────────────────────────────────────────────────────────────────
FEED_TRUST_TIERS = {
    "custom": "HIGH", "historical": "HIGH",
    "feodo_tracker": "HIGH", "feodo_tracker_aggressive": "HIGH", "abuseipdb": "HIGH",
    "threatfox_recent": "HIGH", "spamhaus_drop": "HIGH", "spamhaus_edrop": "HIGH",
    "cins_army": "HIGH", "emerging_threats": "HIGH", "emerging_threats_fwrules": "HIGH",
    "greensnow": "HIGH", "dshield_blocklist": "HIGH", "alienvault_reputation": "HIGH", "talos_intel": "HIGH",
    "sslbl_abuse_ch": "HIGH", "osint_bambenek_c2": "HIGH", "snort_ip_filter": "HIGH",
    
    "blocklist_de": "MEDIUM", "blocklist_de_ssh": "MEDIUM", "blocklist_de_mail": "MEDIUM",
    "blocklist_de_apache": "MEDIUM", "bruteforceblocker": "MEDIUM", "criticalpath_security": "MEDIUM",
    "dan_tor": "MEDIUM", "tor_bulk_exit": "MEDIUM", "bbcan177_ms1": "MEDIUM",
    "botvrij": "MEDIUM", "binary_defense": "MEDIUM", "stopforumspam_toxic": "MEDIUM", "blocklist_net_bots": "MEDIUM",
    "blocklist_net_strongips": "MEDIUM", "dataplane_sipinv": "MEDIUM", "dataplane_sshclient": "MEDIUM",
    "dataplane_sshpwauth": "MEDIUM", "dataplane_vnclogin": "MEDIUM",
    
    "firehol_level1": "LOW", "firehol_level2": "LOW", "ipsum": "LOW",
    "ipsum_level2": "LOW", "ipsum_level3": "LOW", "ipsum_level4": "LOW",
    "ipsum_level5": "LOW", "blackbook": "LOW", "romainmarcoux_outgoing_40k": "LOW",
    "romainmarcoux_outgoing_aa": "LOW", "romainmarcoux_outgoing_ab": "LOW",
    "firehol_level3": "LOW", "firehol_level4": "LOW",
}

def process_ip_metadata(ip_sources: Dict[str, Set[int]], false_positives: set) -> Dict[int, dict]:
    """Generates rich IP tagging and assigns trust scores."""
    ip_metadata = defaultdict(lambda: {"sources": set(), "tags": set()})
    
    for src, ips in ip_sources.items():
        cat = FEED_CATEGORIES.get(src, "Mixed")
        for ip in ips:
            ip_str = int_to_ip(ip) if isinstance(ip, int) else ip
            if ip_str in false_positives: continue
            
            ip_metadata[ip]["sources"].add(src)
            if cat != "Mixed":
                ip_metadata[ip]["tags"].add(cat)

    filtered = {}
    for ip, data in ip_metadata.items():
        sources = data["sources"]
        num_sources = len(sources)
        tiers = [FEED_TRUST_TIERS.get(s, "LOW") for s in sources]
        
        score = "LOW"
        if "HIGH" in tiers:
            score = "HIGH"
        elif "MEDIUM" in tiers:
            score = "MEDIUM"
            
        filtered[ip] = {
            "ip": int_to_ip(ip),
            "count": num_sources,
            "score": score,
            "tags": sorted(list(data["tags"])) if data["tags"] else ["Mixed"],
            "sources": list(sources)
        }
    return filtered


# ─────────────────────────────────────────────────────────────────────────────
# Main Async Runner
# ─────────────────────────────────────────────────────────────────────────────
async def run_async_collector():
    t_start = time.time()
    log.info("═" * 55)
    log.info("  Threatbase v4 — Async Threat Aggregator (S3 + JSON Tagging)")
    log.info("═" * 55)
    
    os.makedirs("ioc", exist_ok=True)
    false_positives = load_false_positives()
    
    ip_sources = {}
    ipv6_sources = {}
    cidr_sources = {}
    domain_results = {}
    hash_sources = {}
    url_sources = {}

    log.info("Spawning all fetch tasks asynchronously...")
    
    conn = aiohttp.TCPConnector(limit=50) # Allow 50 concurrent connections
    async with aiohttp.ClientSession(connector=conn) as session:
        # Create all tasks
        tasks = []
        task_info = [] # Track what task does what
        
        for name, url in FEEDS.items():
            tasks.append(fetch_feed_async(session, name, url))
            task_info.append(('ip', name))
            
        for name, url in DOMAIN_FEEDS.items():
            tasks.append(fetch_domain_feed_async(session, name, url))
            task_info.append(('domain', name))
            
        for name, url in HASH_FEEDS.items():
            tasks.append(fetch_hash_feed_async(session, name, url))
            task_info.append(('hash', name))
            
        for name, url in URL_FEEDS.items():
            tasks.append(fetch_url_feed_async(session, name, url))
            task_info.append(('url', name))
            
        for name, url in THREATFOX_FEEDS.items():
            tasks.append(fetch_threatfox_async(session, name, url))
            task_info.append(('tf', name))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for (feed_type, name), res in zip(task_info, results):
            if isinstance(res, Exception):
                log.error(f"Task {name} completely failed: {res}")
                continue
                
            if not res: continue
            
            if feed_type == 'ip':
                ip_sources[name] = res.get('ipv4', set())
                ipv6_sources[name] = res.get('ipv6', set())
                cidr_sources[name] = res.get('cidrs', set())
            elif feed_type == 'domain':
                domain_results[name] = res
            elif feed_type == 'hash':
                hash_sources[name] = res
            elif feed_type == 'url':
                url_sources[name] = res
            elif feed_type == 'tf':
                if res.get("ips"): ip_sources[name] = res["ips"]
                if res.get("ipv6"): ipv6_sources[name] = res["ipv6"]
                if res.get("cidrs"): cidr_sources[name] = res["cidrs"]
                if res.get("domains"): domain_results[name] = res["domains"]
                if res.get("hashes"): hash_sources[name] = res["hashes"]
                if res.get("urls"): url_sources[name] = res["urls"]

    log.info(f"All feeds downloaded and parsed in {time.time()-t_start:.1f}s")
    
    # Process Trust Tiers & IP Tagging
    log.info("Processing rich IP tags and trust scores...")
    filtered_ip_info = process_ip_metadata(ip_sources, false_positives)
    
    # Sort IPs rapidly using their integer values
    sorted_ips = sorted(filtered_ip_info.keys())
    
    # Write JSON with rich metadata
    log.info("Writing threatbase-ip.json...")
    json_output_path = "ioc/threatbase-ip.json"
    ip_list_out = [filtered_ip_info[ip] for ip in sorted_ips]
    with open(json_output_path, "w", encoding="utf-8") as f:
        json.dump(ip_list_out, f, indent=2)

    # Write Text outputs
    log.info("Writing threatbase-ip.txt...")
    txt_output_path = "ioc/threatbase-ip.txt"
    timestamp = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    
    with open(txt_output_path, "w", encoding="utf-8", buffering=1 << 16) as f:
        f.write("# Threatbase Threat Intelligence Feed - IPs\n")
        f.write(f"# Last update: {timestamp}\n")
        f.write("# Format: IP,FeedCount,RiskScore,Tags\n")
        for ip in sorted_ips:
            info = filtered_ip_info[ip]
            tags_str = "|".join(info["tags"])
            f.write(f"{info['ip']},{info['count']},{info['score']},{tags_str}\n")
            
    # Write domains
    all_domains = sorted(set().union(*domain_results.values()))
    with open("ioc/threatbase-domain.txt", "w", encoding="utf-8") as f:
        for d in all_domains:
            if d not in false_positives: f.write(f"{d}\n")
            
    # Write hashes
    all_hashes = sorted(set().union(*hash_sources.values()))
    with open("ioc/threatbase-hash.txt", "w", encoding="utf-8") as f:
        for h in all_hashes:
            f.write(f"{h}\n")
            
    # Write urls
    all_urls = sorted(set().union(*url_sources.values()))
    with open("ioc/threatbase-url.txt", "w", encoding="utf-8") as f:
        for u in all_urls:
            f.write(f"{u}\n")
            
    # Write IPv6
    all_ipv6 = sorted(set().union(*ipv6_sources.values()))
    with open("ioc/threatbase-ipv6.txt", "w", encoding="utf-8") as f:
        for ipv6 in all_ipv6:
            if ipv6 not in false_positives: f.write(f"{ipv6}\n")
            
    # Write CIDRs
    all_cidrs = sorted(set().union(*cidr_sources.values()))
    with open("ioc/threatbase-cidr.txt", "w", encoding="utf-8") as f:
        for cidr in all_cidrs:
            if cidr not in false_positives: f.write(f"{cidr}\n")
            
    # Write stats.json for github action diffs
    stats = {
        "total_unique_ips": len(sorted_ips),
        "total_unique_ipv6": len(all_ipv6),
        "total_unique_cidrs": len(all_cidrs),
        "total_unique_domains": len(all_domains),
        "total_unique_hashes": len(all_hashes),
        "total_unique_urls": len(all_urls)
    }
    with open("ioc/stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f)
        
    # S3 Upload Phase Disabled
    log.info("Skipping Supabase S3 Uploads as requested...")
    # upload_to_supabase(txt_output_path, "threatbase-ip.txt")
    # upload_to_supabase(json_output_path, "threatbase-ip.json")
    # upload_to_supabase("ioc/threatbase-domain.txt", "threatbase-domain.txt")
    # upload_to_supabase("ioc/threatbase-hash.txt", "threatbase-hash.txt")
    # upload_to_supabase("ioc/threatbase-url.txt", "threatbase-url.txt")
    # upload_to_supabase("ioc/threatbase-ipv6.txt", "threatbase-ipv6.txt")
    # upload_to_supabase("ioc/threatbase-cidr.txt", "threatbase-cidr.txt")
    # upload_to_supabase("ioc/stats.json", "stats.json")
    
    elapsed = time.time() - t_start
    log.info("═" * 55)
    log.info(f"  Finished gracefully in {elapsed:.1f}s")
    log.info(f"  Total Valid IPs: {len(sorted_ips)}")
    log.info("═" * 55)


def main():
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_async_collector())

if __name__ == "__main__":
    main()
