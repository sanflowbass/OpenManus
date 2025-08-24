from __future__ import annotations
from typing import Optional, Dict, Any
import httpx
from curl_cffi import requests as curl

class StealthHttpClient:
    def __init__(self, proxy: Optional[str] = None):
        self.proxy = proxy

    def httpx_client(self) -> httpx.Client:
        proxies = None
        if self.proxy:
            proxies = {"http": self.proxy, "https": self.proxy}
        return httpx.Client(proxies=proxies, http2=True, timeout=30.0, verify=False)

    def curl_get(self, url: str, headers: Optional[Dict[str, str]] = None) -> curl.Response:
        return curl.get(url, headers=headers or {}, impersonate="chrome", proxy=self.proxy)

    def curl_post(self, url: str, data: Any = None, headers: Optional[Dict[str, str]] = None) -> curl.Response:
        return curl.post(url, data=data, headers=headers or {}, impersonate="chrome", proxy=self.proxy)