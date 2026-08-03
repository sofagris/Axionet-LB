export type ComponentPropField = {
  key: string;
  labelKey: string;
  placeholder?: string;
};

/** Default editable props per component role (Designer canvas). */
export function defaultComponentProps(role: string): Record<string, string> {
  switch (role) {
    case "frontend":
      return {
        name: "fe_http",
        bind: "*:443",
        mode: "http",
        default_backend: "",
      };
    case "backend":
      return {
        name: "be_app",
        balance: "roundrobin",
        mode: "http",
      };
    case "server":
      return {
        name: "s1",
        address: "",
        port: "80",
        check: "enabled",
        weight: "100",
      };
    case "error-page":
      return {
        name: "not-found",
        status_code: "404",
        title: "Not Found",
      };
    case "listen":
      return { listen: "0.0.0.0:4180" };
    case "oidc":
      return { issuer_url: "", client_id: "", redirect_url: "" };
    case "upstream":
      return { upstream_url: "" };
    case "external":
      return { peer_ip: "", asn: "" };
    case "service":
      return { router_id: "" };
    case "routes":
      return { prefix: "" };
    case "realm":
      return { realm: "" };
    case "clients":
      return { client_id: "" };
    case "users":
      return { group: "" };
    default:
      return {};
  }
}

export function componentPropFields(role: string): ComponentPropField[] {
  switch (role) {
    case "frontend":
      return [
        { key: "name", labelKey: "designer.props.name", placeholder: "fe_http" },
        { key: "bind", labelKey: "designer.props.bind", placeholder: "*:443" },
        { key: "mode", labelKey: "designer.props.mode", placeholder: "http" },
        {
          key: "default_backend",
          labelKey: "designer.props.defaultBackend",
          placeholder: "be_app",
        },
      ];
    case "backend":
      return [
        { key: "name", labelKey: "designer.props.name", placeholder: "be_app" },
        { key: "balance", labelKey: "designer.props.balance", placeholder: "roundrobin" },
        { key: "mode", labelKey: "designer.props.mode", placeholder: "http" },
      ];
    case "server":
      return [
        { key: "name", labelKey: "designer.props.name", placeholder: "s1" },
        { key: "address", labelKey: "designer.props.address", placeholder: "10.0.0.10" },
        { key: "port", labelKey: "designer.props.port", placeholder: "80" },
        { key: "check", labelKey: "designer.props.check", placeholder: "enabled" },
        { key: "weight", labelKey: "designer.props.weight", placeholder: "100" },
      ];
    case "error-page":
      return [
        { key: "name", labelKey: "designer.props.name", placeholder: "not-found" },
        { key: "status_code", labelKey: "designer.props.statusCode", placeholder: "404" },
        { key: "title", labelKey: "designer.props.errorTitle", placeholder: "Not Found" },
      ];
    case "listen":
      return [{ key: "listen", labelKey: "designer.props.listen", placeholder: "0.0.0.0:4180" }];
    case "oidc":
      return [
        { key: "issuer_url", labelKey: "designer.props.issuerUrl" },
        { key: "client_id", labelKey: "designer.props.clientId" },
        { key: "redirect_url", labelKey: "designer.props.redirectUrl" },
      ];
    case "upstream":
      return [{ key: "upstream_url", labelKey: "designer.props.upstreamUrl" }];
    case "external":
      return [
        { key: "peer_ip", labelKey: "designer.props.peerIp" },
        { key: "asn", labelKey: "designer.props.asn" },
      ];
    case "service":
      return [{ key: "router_id", labelKey: "designer.props.routerId" }];
    case "routes":
      return [{ key: "prefix", labelKey: "designer.props.prefix" }];
    case "realm":
      return [{ key: "realm", labelKey: "designer.props.realm" }];
    case "clients":
      return [{ key: "client_id", labelKey: "designer.props.clientId" }];
    case "users":
      return [{ key: "group", labelKey: "designer.props.group" }];
    default:
      return [];
  }
}
