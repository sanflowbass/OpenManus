from __future__ import annotations
import os
import json
import asyncio
import click
from rich.console import Console
from hunter.config import load_config
from hunter.navigator import Navigator
from hunter.zap import ZapClient
from hunter.stealth_http import StealthHttpClient

console = Console()

@click.group()
def cli():
	"""Hunter orchestrator CLI"""
	pass

@cli.command()
@click.option("--config-path", default="config/default.yaml")
@click.option("--url", required=True)
@click.option("--har-path", default="out.har")
def browse(config_path: str, url: str, har_path: str):
	cfg = load_config(config_path)
	proxy = None
	if cfg.proxy and (cfg.proxy.http or cfg.proxy.https):
		proxy = {"server": cfg.proxy.http or cfg.proxy.https}
	navigator = Navigator(proxy=proxy, user_agent=cfg.playwright.user_agent, headless=cfg.playwright.headless, timeout_ms=cfg.playwright.timeout_ms)
	console.log(f"Navigating {url} via proxy={proxy}")
	asyncio.run(navigator.navigate_and_har(url, har_path))
	console.log(f"Saved HAR to {har_path}")

@cli.command()
@click.option("--config-path", default="config/default.yaml")
@click.option("--url", required=True)
def zap_scan(config_path: str, url: str):
	cfg = load_config(config_path)
	zap = ZapClient(host=cfg.zap.host, port=cfg.zap.port, api_key=cfg.zap.api_key)
	console.log(f"ZAP version: {zap.version()}")
	console.log("Starting spider...")
	console.log(zap.spider(url))
	if cfg.zap.ajax_spider:
		console.log("Starting AJAX spider...")
		console.log(zap.ajax_spider(url))
	console.log("Starting active scan...")
	console.log(zap.active_scan(url))
	console.log("Alerts:")
	console.log(json.dumps(zap.alerts(baseurl=url), indent=2))

@cli.command()
@click.option("--config-path", default="config/default.yaml")
@click.option("--url", required=True)
@click.option("--method", default="GET")
@click.option("--data", default=None)
def stealth_request(config_path: str, url: str, method: str, data: str | None):
	cfg = load_config(config_path)
	proxy = cfg.proxy.http or cfg.proxy.https if cfg.proxy else None
	client = StealthHttpClient(proxy=proxy)
	if method.upper() == "GET":
		resp = client.curl_get(url)
	else:
		resp = client.curl_post(url, data=data)
	console.log({"status_code": resp.status_code, "headers": dict(resp.headers), "text_snippet": resp.text[:200]})

if __name__ == "__main__":
	cli()