# AxioNet FRR image with iptables for routed VIP DNAT (M9.2).
FROM quay.io/frrouting/frr:10.2.6

USER root
RUN if command -v apt-get >/dev/null 2>&1; then \
      apt-get update \
      && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends iptables \
      && rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
      apk add --no-cache iptables; \
    else \
      echo "Unsupported base image for iptables install" >&2; exit 1; \
    fi

# Keep upstream entrypoint/user behavior.
