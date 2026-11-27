"""Parse cactus Nuxt bundle for API / Face ID strings."""
from __future__ import annotations

import re
import urllib.request

JS_URL = "https://cactustizim.com/_nuxt/DaUPe2QS.js"


def main() -> None:
    js = urllib.request.urlopen(JS_URL, timeout=60).read().decode("utf-8", "replace")
    print("len", len(js))
    for m in re.finditer(r".{0,60}baseURL.{0,100}", js):
        print("BASE", m.group(0).replace("\n", " ")[:180])
    print("NUXT", sorted(set(re.findall(r"NUXT_[A-Z0-9_]{0,40}", js)))[:50])
    for pat in (
        "/api/",
        "auth/login",
        "face-login",
        "face_login",
        "FaceId",
        "faceId",
        "liveness",
        "ПРИБЛИЗ",
        "Проверка Face",
        "неудачн",
        "apiBase",
        "API_BASE",
        "VITE_API",
    ):
        print("count", pat, js.count(pat))
    apis = set(
        re.findall(r"[\"']([^\"']{0,50}api[^\"']{0,80})[\"']", js, flags=re.I)
    )
    print("api_string_count", len(apis))
    for a in sorted(apis)[:80]:
        print("A", a)
    for m in re.finditer(r".{0,40}runtimeConfig.{0,120}", js):
        print("RT", m.group(0).replace("\n", " ")[:180])
    # Relative auth paths
    for m in re.finditer(r"[\"'](/[^\"']*auth[^\"']*)[\"']", js):
        p = m.group(1)
        if "login" in p or "face" in p.lower():
            print("PATH", p)


if __name__ == "__main__":
    main()
