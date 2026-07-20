import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { InterfacesPage } from "./pages/InterfacesPage";
import { NetworksPage } from "./pages/NetworksPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="interfaces" element={<InterfacesPage />} />
        <Route path="networks" element={<NetworksPage />} />
      </Route>
    </Routes>
  );
}
