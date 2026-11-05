import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { MembersPage } from "./members/MembersPage";
import { DocumentPage } from "./documents/DocumentPage";
import { FilePage } from "./documents/FilePage";
import { SpacePage } from "./documents/SpacePage";
import { TrashPage } from "./documents/TrashPage";
import { WorkStatusPage } from "./workstatus/WorkStatusPage";
import { colorSchemeManager } from "./theme";
import { Toaster } from "./toast/Toaster";
import { AuthGate, LoginRoute } from "./user/AuthGate";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export default function App() {
  return (
    <MantineProvider defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<AuthGate><AppLayout /></AuthGate>}>
              <Route path="/" element={<Navigate to="/work-status" replace />} />
              {/* 없는 주소는 첫 화면(근무 상황표)으로 */}
              <Route path="*" element={<Navigate to="/work-status" replace />} />
              <Route path="/work-status" element={<WorkStatusPage />} />
              <Route path="/spaces/:spaceId" element={<SpacePage />} />
              <Route path="/documents/:documentId" element={<DocumentPage />} />
              <Route path="/files/:documentId" element={<FilePage />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/members" element={<MembersPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
    </MantineProvider>
  );
}
