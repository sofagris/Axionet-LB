# Varnish

Declarative App Store package for Designer + Catalog. Control-plane runtime is enabled via `VarnishPlugin` (`service_type=varnish`): create/apply/reconcile write `default.vcl` and run `varnish:7.6`. Designer hydrate remains `none`.
