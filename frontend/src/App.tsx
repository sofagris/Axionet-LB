import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { CatalogPage } from "./pages/CatalogPage";
import { CreateInstanceWizardPage } from "./pages/CreateInstanceWizardPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HaproxyDetailPage } from "./pages/HaproxyDetailPage";
import { InstancesPage } from "./pages/InstancesPage";
import { InterfacesPage } from "./pages/InterfacesPage";
import { NetworksPage } from "./pages/NetworksPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="interfaces" element={<InterfacesPage />} />
        <Route path="networks" element={<NetworksPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="instances" element={<InstancesPage />} />
        <Route path="instances/new" element={<CreateInstanceWizardPage />} />
        <Route path="instances/:instanceId/haproxy" element={<HaproxyDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
