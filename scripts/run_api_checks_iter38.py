import os
import requests


def main() -> int:
    base_url = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
    if not base_url:
        print("ERROR: EXPO_PUBLIC_BACKEND_URL not set")
        return 2

    endpoints = [
        ("GET", f"{base_url}/api/"),
        ("GET", f"{base_url}/api/status"),
        ("GET", f"{base_url}/api/manual-aitour"),
    ]

    failed = 0
    for method, url in endpoints:
        try:
            r = requests.request(method, url, timeout=20)
            print(f"{method} {url} -> {r.status_code}")
            if r.status_code >= 400:
                failed += 1
        except Exception as exc:
            failed += 1
            print(f"{method} {url} -> ERROR: {exc}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
