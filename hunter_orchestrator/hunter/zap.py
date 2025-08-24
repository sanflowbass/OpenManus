from __future__ import annotations
import os
from typing import Optional
import requests

class ZapClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 8090, api_key: Optional[str] = None):
        self.base = f"http://{host}:{port}"
        self.api_key = api_key or os.getenv("ZAP_API_KEY")

    def _params(self, extra: Optional[dict] = None):
        params = {"apikey": self.api_key} if self.api_key else {}
        params.update(extra or {})
        return params

    def version(self):
        return requests.get(f"{self.base}/JSON/core/view/version/").json()

    def spider(self, url: str):
        return requests.get(f"{self.base}/JSON/spider/action/scan/", params=self._params({"url": url})).json()

    def ajax_spider(self, url: str):
        return requests.get(f"{self.base}/JSON/ajaxSpider/action/scan/", params=self._params({"url": url})).json()

    def active_scan(self, url: str, recurse: bool = True):
        return requests.get(f"{self.base}/JSON/ascan/action/scan/", params=self._params({"url": url, "recurse": str(recurse).lower()})).json()

    def alerts(self, baseurl: Optional[str] = None):
        params = {} if baseurl is None else {"baseurl": baseurl}
        return requests.get(f"{self.base}/JSON/alert/view/alerts/", params=self._params(params)).json()