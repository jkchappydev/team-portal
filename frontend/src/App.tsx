import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { MembersPage } from "./members/MembersPage";
import { DocumentPage } from "./documents/DocumentPage";
import { FilePage } from "./documents/FilePage";
import { SpacePage } from "./documents/SpacePage";
import { TrashPage } from "./documents/TrashPage";
import { FavoritesPage } from "./documents/FavoritesPage";
import { WorkStatusPage } from "./workstatus/WorkStatusPage";
import { ContactsPage } from "./contacts/ContactsPage";
import { colorSchemeManager } from "./theme";
import { Toaster } from "./toast/Toaster";
import { AuthGate, LoginRoute } from "./user/AuthGate";
import { ProfileSetupPreview } from "./user/ProfileSetup";
import { NotFoundPage } from "./layout/NotFoundPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export default function App() {
  return (
    <MantineProvider defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            {/* 개발자용 최초 가입 정보 입력 화면 미리보기 (포털 틀 없이 실제 화면 그대로) */}
            <Route path="/preview/profile-setup" element={<AuthGate><ProfileSetupPreview /></AuthGate>} />
            <Route element={<AuthGate><AppLayout /></AuthGate>}>
              <Route path="/" element={<Navigate to="/work-status" replace />} />
              {/* 없는 주소는 404 안내 후 첫 화면으로 */}
              <Route path="*" element={<NotFoundPage />} />
              <Route path="/work-status" element={<WorkStatusPage />} />
              <Route path="/spaces/:spaceId" element={<SpacePage />} />
              <Route path="/documents/:documentId" element={<DocumentPage />} />
              {/* 예전 WBS 주소는 그 일정이 들어 있는 페이지로 이동 */}
              <Route path="/wbs/:documentId" element={<DocumentPage />} />
              <Route path="/files/:documentId" element={<FilePage />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/team" element={<MembersPage mode="list" />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/members" element={<MembersPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
    </MantineProvider>
  );
}
