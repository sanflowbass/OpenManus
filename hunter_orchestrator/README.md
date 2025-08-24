# Hunter Orchestrator

Orquestrador para navegação com Playwright via proxy (Burp/ZAP), captura de HAR e integração com OWASP ZAP, mais cliente HTTP stealth (curl_cffi/httpx) para reproduzir tráfego fora do navegador.

## Setup rápido

```bash
cd hunter_orchestrator
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
# Instale os browsers do Playwright caso necessário:
# python -m playwright install chromium
```

## Config

Edite `config/default.yaml` (ou use variáveis `.env`).

- Proxy: aponte para Burp (`http://127.0.0.1:8080`) ou ZAP (`http://127.0.0.1:8090`).
- ZAP: configure host/port e `ZAP_API_KEY` se habilitado.

## Uso

- Navegar e salvar HAR via proxy:
```bash
python main.py browse --url https://example.com --har-path out.har
```

- Disparar scan no ZAP:
```bash
python main.py zap_scan --url https://example.com
```

- Requisição stealth (curl_cffi) via proxy:
```bash
python main.py stealth_request --url https://example.com
```

## Notas

- Para Burp: ative o Proxy listener (ex: 127.0.0.1:8080) e instale o certificado no navegador se for necessário navegar HTTPS de forma manual.
- Para ZAP: inicie ZAP com a API habilitada e defina `ZAP_API_KEY` caso requerido.