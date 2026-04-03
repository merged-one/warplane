import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { TracesPage } from "./pages/TracesPage.js";
import { TraceDetailPage } from "./pages/TraceDetailPage.js";
import { FailuresPage } from "./pages/FailuresPage.js";
import { ScenariosPage } from "./pages/ScenariosPage.js";
import { DocsPage } from "./pages/DocsPage.js";
import { RelayerOpsPage } from "./pages/RelayerOpsPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="traces" element={<TracesPage />} />
          <Route path="traces/:messageId" element={<TraceDetailPage />} />
          <Route path="failures" element={<FailuresPage />} />
          <Route path="relayer" element={<RelayerOpsPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="docs" element={<DocsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
