import requests
import csv

r = requests.get('https://bazaar.abuse.ch/export/csv/recent/')
lines = [l for l in r.text.splitlines() if not l.startswith('#')]
reader = csv.reader(lines, delimiter=',', quotechar='"', skipinitialspace=True)
row = next(reader)
print(row)
print(f"Len: {len(row)}")
if len(row) >= 9:
    print(f"SHA256: {row[1].replace('\"', '').strip()}")
    print(f"Signature: {row[8].replace('\"', '').strip()}")
