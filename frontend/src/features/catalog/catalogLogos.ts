import alertmanager from "../../assets/catalog/alertmanager.svg";
import guacamole from "../../assets/catalog/apache-guacamole.svg";
import cloudflare from "../../assets/catalog/cloudflare.svg";
import coraza from "../../assets/catalog/corazawaf-logo_animal_only.png";
import frr from "../../assets/catalog/frrouting.svg";
import genericTcp from "../../assets/catalog/generic-tcp-service.svg";
import grafana from "../../assets/catalog/grafana.svg";
import haproxy from "../../assets/catalog/haproxy.svg";
import keycloak from "../../assets/catalog/keycloak.svg";
import nginx from "../../assets/catalog/nginx.svg";
import powerdns from "../../assets/catalog/powerdns.svg";
import prometheus from "../../assets/catalog/prometheus.svg";
import secureWeb from "../../assets/catalog/secure-web-frontend.svg";
import stepCa from "../../assets/catalog/step-ca.svg";

/** Logo URLs keyed by catalog item id. Missing ids fall back to monogram. */
export const CATALOG_LOGOS: Partial<Record<string, string>> = {
  haproxy,
  frr,
  nginx,
  dnsdist: powerdns,
  "powerdns-auth": powerdns,
  "powerdns-recursor": powerdns,
  "powerdns-platform": powerdns,
  "identity-mfa": keycloak,
  "pki-acme": stepCa,
  "coraza-waf": coraza,
  "secure-web-frontend": secureWeb,
  prometheus,
  alertmanager,
  grafana,
  "monitoring-stack": prometheus,
  guacamole,
  "generic-tcp": genericTcp,
  cloudflare,
};

export function catalogLogoSrc(itemId: string): string | undefined {
  return CATALOG_LOGOS[itemId];
}
