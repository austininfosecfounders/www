#!/usr/bin/env python3
"""Fetch a logo for each company/investor from its website's icons.

Prefers apple-touch-icon (usually 180px), then the largest declared icon,
then /favicon.ico. Saves to assets/img/logos/<slug>.<ext> and writes a
`logo:` field back into the YAML data files.

Usage: python3 scripts/fetch_logos.py [--force]
"""
import os, re, sys, urllib.request, urllib.parse, ssl
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img", "logos")
DATA = ["_data/companies.yml", "_data/investors.yml"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
FORCE = "--force" in sys.argv
TYPES = {"image/png": "png", "image/svg+xml": "svg", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
         "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def get(url, limit=3_000_000):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
        return r.geturl(), r.headers.get("Content-Type", "").split(";")[0].strip().lower(), r.read(limit)


class Icons(HTMLParser):
    def __init__(self):
        super().__init__()
        self.icons = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        rel = (a.get("rel") or "").lower()
        if tag == "link" and "icon" in rel and a.get("href"):
            size = 0
            m = re.search(r"(\d+)x\d+", a.get("sizes") or "")
            if m:
                size = int(m.group(1))
            elif "apple-touch-icon" in rel:
                size = 180
            elif "svg" in (a.get("type") or "") or a["href"].split("?")[0].endswith(".svg"):
                size = 150
            if "mask-icon" in rel:
                size = -1  # monochrome Safari pinned-tab icon
            self.icons.append((size, a["href"]))


def candidates(site):
    final, _, body = get(site)
    p = Icons()
    p.feed(body.decode("utf-8", "ignore"))
    urls = [urllib.parse.urljoin(final, h) for s, h in sorted(p.icons, key=lambda x: -x[0]) if s >= 0]
    urls.append(urllib.parse.urljoin(final, "/favicon.ico"))
    return urls


def fetch(site):
    for url in candidates(site):
        try:
            _, ctype, data = get(url)
        except Exception:
            continue
        ext = TYPES.get(ctype) or os.path.splitext(urllib.parse.urlparse(url).path)[1].lstrip(".").lower()
        if ext in ("png", "svg", "ico", "jpg", "jpeg", "webp", "gif") and len(data) > 100 and b"<html" not in data[:500].lower():
            return ext, data
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    for rel in DATA:
        path = os.path.join(ROOT, rel)
        text = open(path).read()
        blocks = re.split(r"(?m)^(?=- name: )", text)
        out = []
        for b in blocks:
            m = re.match(r"- name: (.+)\n", b)
            u = re.search(r"(?m)^  url: \"?([^\"\n]+)\"?$", b)
            if not m or not u or ("  logo:" in b and not FORCE):
                out.append(b)
                continue
            name = m.group(1).strip().strip('"')
            try:
                got = fetch(u.group(1))
            except Exception as e:
                got = None
                print(f"  ! {name}: {e}")
            if not got:
                print(f"  - {name}: no icon found")
                out.append(b)
                continue
            ext, data = got
            fname = f"{slug(name)}.{ext}"
            open(os.path.join(OUT, fname), "wb").write(data)
            b = re.sub(r"(?m)^  logo: .*\n", "", b)
            b = b.replace(m.group(0), m.group(0) + f"  logo: /assets/img/logos/{fname}\n", 1)
            print(f"  + {name}: {fname} ({len(data)} bytes)")
            out.append(b)
        open(path, "w").write("".join(out))


if __name__ == "__main__":
    main()
