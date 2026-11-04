import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { MembersPage } from "./members/MembersPage";
import { DocumentPage } from "./documents/DocumentPage";
import { SearchPage } from "./documents/SearchPage";
import { SpacePage } from "./documents/SpacePage";
import { TrashPage } from "./documents/TrashPage";
import { WorkStatusPage } from "./workstatus/WorkStatusPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export default function App() {
  return (
    <MantineProvider forceColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/work-status" replace />} />
              <Route path="/work-status" element={<WorkStatusPage />} />
              <Route path="/spaces/:spaceId" element={<SpacePage />} />
              <Route path="/documents/:documentId" element={<DocumentPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/members" element={<MembersPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}
