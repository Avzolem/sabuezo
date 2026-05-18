#!/bin/bash
# Configura Tailscale Funnel para exponer FastAPI :8787 públicamente.
set -e

echo "=== tailscale version ==="
tailscale version | head -3

echo ""
echo "=== status ==="
tailscale status | head -5

echo ""
echo "=== hostname ==="
tailscale status --self --json 2>/dev/null | grep -E '"HostName"|"DNSName"' | head -3

echo ""
echo "=== probando 'serve status' (puede pedir activar HTTPS) ==="
echo "$SUDO_PWD" | sudo -S -p "" tailscale serve status 2>&1 | head -20 || true

echo ""
echo "=== configurar serve → :8787 ==="
echo "$SUDO_PWD" | sudo -S -p "" tailscale serve --bg --https 443 http://localhost:8787 2>&1 | head -10

echo ""
echo "=== habilitar Funnel en puerto 443 ==="
echo "$SUDO_PWD" | sudo -S -p "" tailscale funnel --bg 443 2>&1 | head -10

echo ""
echo "=== estado final ==="
echo "$SUDO_PWD" | sudo -S -p "" tailscale serve status 2>&1 | head -20
echo "$SUDO_PWD" | sudo -S -p "" tailscale funnel status 2>&1 | head -20
