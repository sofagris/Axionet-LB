import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { AppLayout } from "./layouts/AppLayout";
import { AuthGatewayDetailPage } from "./pages/AuthGatewayDetailPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { CreateInstanceWizardPage } from "./pages/CreateInstanceWizardPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomDashboardPage } from "./pages/CustomDashboardPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DashboardsPage } from "./pages/DashboardsPage";
import { FrrDetailPage } from "./pages/FrrDetailPage";
import { HaproxyDetailPage } from "./pages/HaproxyDetailPage";
import { InstancesPage } from "./pages/InstancesPage";
import { KeycloakDetailPage } from "./pages/KeycloakDetailPage";
import { InterfacesPage } from "./pages/InterfacesPage";
import { LoginPage } from "./pages/LoginPage";
import { NetworksPage } from "./pages/NetworksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemLogsPage } from "./pages/SystemLogsPage";
import { IdentityPage } from "./pages/IdentityPage";
import { UsersPage } from "./pages/UsersPage";
import { VipsPage } from "./pages/VipsPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboards" element={<DashboardsPage />} />
          <Route path="dashboards/:dashboardId" element={<CustomDashboardPage />} />
          <Route path="interfaces" element={<InterfacesPage />} />
          <Route path="networks" element={<NetworksPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="customers/:customerId/apps/:appId" element={<ApplicationDetailPage />} />
          <Route path="instances" element={<InstancesPage />} />
          <Route path="instances/new" element={<CreateInstanceWizardPage />} />
          <Route path="instances/:instanceId/haproxy" element={<HaproxyDetailPage />} />
          <Route path="instances/:instanceId/frr" element={<FrrDetailPage />} />
          <Route path="instances/:instanceId/keycloak-mgmt" element={<KeycloakDetailPage />} />
          <Route path="instances/:instanceId/keycloak-apps" element={<KeycloakDetailPage />} />
          <Route path="instances/:instanceId/auth-gateway" element={<AuthGatewayDetailPage />} />
          <Route path="vips" element={<VipsPage />} />
          <Route path="logs" element={<SystemLogsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="identity" element={<IdentityPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
