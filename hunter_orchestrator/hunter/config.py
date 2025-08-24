import os
import yaml
from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class ProxyConfig:
    http: Optional[str] = None
    https: Optional[str] = None
    socks: Optional[str] = None

@dataclass
class PlaywrightConfig:
    headless: bool = True
    user_agent: Optional[str] = None
    timeout_ms: int = 30000

@dataclass
class ZapConfig:
    host: str = "127.0.0.1"
    port: int = 8090
    api_key: Optional[str] = None
    context_name: str = "hunter-context"
    policy: str = "Default Policy"
    spider_max_children: int = 20
    ajax_spider: bool = True

@dataclass
class AppConfig:
    proxy: ProxyConfig
    playwright: PlaywrightConfig
    zap: ZapConfig


def load_config(path: str) -> AppConfig:
    with open(path, "r", encoding="utf-8") as f:
        raw: Dict[str, Any] = yaml.safe_load(f)
    # env expansion for api_key
    api_key = os.getenv("ZAP_API_KEY", (raw.get("zap", {}) or {}).get("api_key"))
    proxy = ProxyConfig(**(raw.get("proxy") or {}))
    playwright = PlaywrightConfig(**(raw.get("playwright") or {}))
    zap = ZapConfig(**{**(raw.get("zap") or {}), "api_key": api_key})
    return AppConfig(proxy=proxy, playwright=playwright, zap=zap)