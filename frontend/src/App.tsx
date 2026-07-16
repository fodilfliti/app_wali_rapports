import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "./api";
import "./theme/tokens.css";
import "./App.css";
import { GuestLoginPage } from "./components/GuestLoginPage";
import { ChangeCodeModal } from "./components/ChangeCodeModal";
import { TopbarProfileMenu } from "./components/TopbarProfileMenu";
import { SnackbarProvider } from "./snackbar/SnackbarContext";
import { AdminMunicipalitiesListPage } from "./pages/AdminMunicipalitiesListPage";
import { AdminDairasListPage } from "./pages/AdminDairasListPage";
import { AdminModiriyatListPage } from "./pages/AdminModiriyatListPage";
import { AdminSchemasPage } from "./pages/AdminSchemasPage";
import { AdminServicesPage } from "./pages/AdminServicesPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import {
  AdminAccessPage,
  AdminHubPage,
  ChefHubPage,
  OfficeHubPage,
  OfficeServicesPage,
  WaliHubPage,
} from "./pages/HubPages";
import {
  AdminRapportsListPage,
  OfficeRapportsListPage,
  OfficeServiceRapportListPage,
  WaliRapportsInboxPage,
} from "./pages/RapportPages";
import {
  OfficeDocumentEditorPage,
  OfficeDocumentsPage,
  OfficeFichesPage,
  OfficeServiceContentHubPage,
  OfficeTableGridPage,
  WaliRapportViewPage,
} from "./pages/DomainEditorPages";
import { OfficeCommuneEditorPage } from "./pages/OfficeCommuneEditorPage";
import { OfficeCommuneBulkEditorPage } from "./pages/OfficeCommuneBulkEditorPage";
import { OfficeCommuneListPage } from "./pages/OfficeCommuneListPage";
import {
  RapportVersionsArchivePage,
} from "./pages/RapportVersionsArchivePage";
import { OfficeServiceConfigPage } from "./pages/OfficeServiceConfigPage";
import {
  OfficeNotificationsBell,
  OfficeNotificationsPage,
} from "./pages/OfficeNotificationsPage";
import { WaliInboxBell } from "./components/WaliInboxBell";
import { ChefInboxBell } from "./components/ChefInboxBell";
import {
  WaliOfficeUsersPage,
  WaliServiceRapportListPage,
  WaliServiceRapportTypesPage,
  WaliUserServicesPage,
} from "./pages/WaliNavigationPages";
import { WaliCalendarPage } from "./pages/WaliCalendarPage";
import {
  OfficeSharedFileDetailPage,
  OfficeSharedFilesPage,
  WaliBroadcastCreatePage,
  WaliBroadcastDetailPage,
  WaliBroadcastsPage,
} from "./pages/SharingPages";
import {
  ChefInstructionDetailPage,
  ChefInstructionsPage,
  OfficeInstructionDetailPage,
  OfficeInstructionsPage,
  WaliInstructionCreatePage,
  WaliInstructionDetailPage,
  WaliInstructionsPage,
} from "./pages/InstructionPages";

function hubPath(role: api.UserRole | undefined) {
  if (role === "ADMIN") return "/";
  if (role === "WALI") return "/wali";
  if (role === "CHEF_CABINET") return "/chef";
  if (role === "OFFICE_USER") return "/office";
  return "/";
}

function OfficeKindRedirect() {
  const { serviceId } = useParams();
  const sid = Number(serviceId);
  if (!sid) return <Navigate to="/office/services" replace />;
  return <Navigate to={`/office/services/${sid}`} replace />;
}

function ChefUserServicesRoute({ token }: { token: string }) {
  const { userId } = useParams();
  const id = Number(userId);
  if (!id) return <Navigate to="/chef/office-users" replace />;
  return <WaliUserServicesPage token={token} userId={id} reviewer="chef" />;
}

function ChefServiceRapportTypesRoute({ token }: { token: string }) {
  const { userId } = useParams();
  const id = Number(userId);
  if (!id) return <Navigate to="/chef/office-users" replace />;
  return <WaliServiceRapportTypesPage token={token} userId={id} reviewer="chef" />;
}

function ChefServiceKindRapportTypesRoute({ token: _token }: { token: string }) {
  const { userId, serviceId } = useParams();
  const id = Number(userId);
  const sid = Number(serviceId);
  if (!id || !sid) return <Navigate to="/chef/office-users" replace />;
  return <Navigate to={`/chef/office-users/${id}/services/${sid}`} replace />;
}

function ChefServiceRapportListRoute({ token }: { token: string }) {
  const { userId } = useParams();
  const id = Number(userId);
  if (!id) return <Navigate to="/chef/office-users" replace />;
  return <WaliServiceRapportListPage token={token} userId={id} reviewer="chef" />;
}

function WaliUserServicesRoute({ token }: { token: string }) {
  const { userId } = useParams();
  const id = Number(userId);
  if (!id) return <Navigate to="/wali/office-users" replace />;
  return <WaliUserServicesPage token={token} userId={id} />;
}

function WaliServiceRapportTypesRoute({ token }: { token: string }) {
  const { userId } = useParams();
  const id = Number(userId);
  if (!id) return <Navigate to="/wali/office-users" replace />;
  return <WaliServiceRapportTypesPage token={token} userId={id} />;
}

function WaliServiceKindRapportTypesRoute({ token: _token }: { token: string }) {
  const { userId, serviceId } = useParams();
  const id = Number(userId);
  const sid = Number(serviceId);
  if (!id || !sid) return <Navigate to="/wali/office-users" replace />;
  return <Navigate to={`/wali/office-users/${id}/services/${sid}`} replace />;
}

function WaliServiceRapportListRoute({ token }: { token: string }) {
  const { userId } = useParams();
  const id = Number(userId);
  if (!id) return <Navigate to="/wali/office-users" replace />;
  return <WaliServiceRapportListPage token={token} userId={id} />;
}

function AppShell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [me, setMe] = useState<api.SessionUser | null>(() => {
    const raw = localStorage.getItem("me");
    return raw ? (JSON.parse(raw) as api.SessionUser) : null;
  });

  const [changeCodeOpen, setChangeCodeOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .fetchMe(token)
      .then((r) => {
        setMe(r.user);
        localStorage.setItem("me", JSON.stringify(r.user));
      })
      .catch(() => {
        setToken(null);
        setMe(null);
        localStorage.removeItem("token");
        localStorage.removeItem("me");
      });
  }, [token]);

  function onLoginSuccess(res: api.LoginResponse) {
    setToken(res.token);
    setMe(res.user);
    localStorage.setItem("token", res.token);
    localStorage.setItem("me", JSON.stringify(res.user));
    navigate(hubPath(res.user.role));
  }

  function logout() {
    setToken(null);
    setMe(null);
    localStorage.removeItem("token");
    localStorage.removeItem("me");
    navigate("/");
  }

  function setLang(next: "ar" | "fr") {
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", next);
  }

  function toggleLang() {
    setLang(i18n.language === "ar" ? "fr" : "ar");
  }

  const lang = (i18n.language === "fr" ? "fr" : "ar") as "ar" | "fr";
  const isRtl = lang === "ar";
  const home = useMemo(() => hubPath(me?.role), [me?.role]);

  if (!token || !me) {
    return (
      <div className="app guest">
        <GuestLoginPage
          onSuccess={onLoginSuccess}
          lang={lang}
          onToggleLang={toggleLang}
        />
      </div>
    );
  }

  return (
    <div className={`app ${isRtl ? "rtl" : "ltr"}`}>
      <header className="topbar">
        <div
          className="brand"
          onClick={() => navigate(home)}
          role="button"
          tabIndex={0}
        >
          {t("appTitle")}
        </div>
        <div className="topbarActions">
          {me.role === "OFFICE_USER" ? (
            <OfficeNotificationsBell token={token} />
          ) : null}
          {me.role === "WALI" ? <WaliInboxBell token={token} /> : null}
          {me.role === "CHEF_CABINET" ? <ChefInboxBell token={token} /> : null}
          <TopbarProfileMenu
            user={me}
            lang={lang}
            onSetLang={setLang}
            onChangeCode={() => setChangeCodeOpen(true)}
            onLogout={logout}
          />
        </div>
      </header>
      <ChangeCodeModal
        token={token}
        open={changeCodeOpen}
        onClose={() => setChangeCodeOpen(false)}
      />
      <main className="main">
        <Routes>
          {me.role === "ADMIN" ? (
            <>
              <Route path="/" element={<AdminHubPage />} />
              <Route
                path="/municipalities"
                element={<AdminMunicipalitiesListPage token={token} />}
              />
              <Route
                path="/dairas"
                element={<AdminDairasListPage token={token} />}
              />
              <Route
                path="/directions"
                element={<AdminModiriyatListPage token={token} />}
              />
              <Route path="/modiriyat" element={<Navigate to="/directions" replace />} />
              <Route path="/users" element={<AdminUsersPage token={token} />} />
              <Route
                path="/admin/rapports"
                element={<AdminRapportsListPage token={token} />}
              />
              <Route
                path="/admin/rapports/:rapportId/view"
                element={<WaliRapportViewPage token={token} audience="admin" />}
              />
              <Route
                path="/admin/departments"
                element={<Navigate to="/admin/services" replace />}
              />
              <Route
                path="/admin/services"
                element={<AdminServicesPage token={token} />}
              />
              <Route
                path="/admin/schemas"
                element={<AdminSchemasPage token={token} />}
              />
              <Route path="/access" element={<AdminAccessPage />} />
            </>
          ) : null}
          {me.role === "OFFICE_USER" || me.role === "ADMIN" ? (
            <>
              <Route path="/office" element={<OfficeHubPage token={token} />} />
              <Route
                path="/office/rapports"
                element={<OfficeRapportsListPage token={token} />}
              />
              <Route
                path="/office/services/folder/:folderId"
                element={<OfficeServicesPage token={token} />}
              />
              <Route
                path="/office/services"
                element={<OfficeServicesPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId"
                element={<OfficeServiceContentHubPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/kinds/:contentKind"
                element={<OfficeKindRedirect />}
              />
              <Route
                path="/office/services/:serviceId/rapports/:rapportTypeId"
                element={<OfficeServiceRapportListPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/table"
                element={<OfficeTableGridPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/documents"
                element={<OfficeDocumentsPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/fiches"
                element={<OfficeFichesPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/communes"
                element={<OfficeCommuneListPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/communes/bulk"
                element={<OfficeCommuneBulkEditorPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/communes/:municipalityCode"
                element={<OfficeCommuneEditorPage token={token} />}
              />
              <Route
                path="/office/services/:serviceId/config"
                element={<OfficeServiceConfigPage token={token} />}
              />
              <Route
                path="/office/notifications"
                element={<OfficeNotificationsPage token={token} />}
              />
              <Route
                path="/office/instructions"
                element={<OfficeInstructionsPage token={token} />}
              />
              <Route
                path="/office/instructions/:id"
                element={<OfficeInstructionDetailPage token={token} />}
              />
              <Route
                path="/office/shared"
                element={<OfficeSharedFilesPage token={token} />}
              />
              <Route
                path="/office/shared/:id"
                element={<OfficeSharedFileDetailPage token={token} />}
              />
              <Route
                path="/office/rapports/:rapportId/document"
                element={<OfficeDocumentEditorPage token={token} />}
              />
              <Route
                path="/office/rapports/:rapportId/versions/:versionId?"
                element={<RapportVersionsArchivePage token={token} />}
              />
            </>
          ) : null}
          {me.role === "WALI" || me.role === "ADMIN" ? (
            <>
              <Route path="/wali" element={<WaliHubPage token={token} />} />
              <Route
                path="/wali/calendar"
                element={<WaliCalendarPage token={token} />}
              />
              <Route
                path="/wali/shared"
                element={<WaliBroadcastsPage token={token} />}
              />
              <Route
                path="/wali/shared/new"
                element={<WaliBroadcastCreatePage token={token} />}
              />
              <Route
                path="/wali/shared/:id"
                element={<WaliBroadcastDetailPage token={token} />}
              />
              <Route
                path="/wali/office-users"
                element={<WaliOfficeUsersPage token={token} />}
              />
              <Route
                path="/wali/office-users/:userId/services/folder/:folderId"
                element={<WaliUserServicesRoute token={token} />}
              />
              <Route
                path="/wali/office-users/:userId/services"
                element={<WaliUserServicesRoute token={token} />}
              />
              <Route
                path="/wali/office-users/:userId/services/:serviceId"
                element={<WaliServiceRapportTypesRoute token={token} />}
              />
              <Route
                path="/wali/office-users/:userId/services/:serviceId/kinds/:contentKind"
                element={<WaliServiceKindRapportTypesRoute token={token} />}
              />
              <Route
                path="/wali/office-users/:userId/services/:serviceId/rapports/:rapportTypeId"
                element={<WaliServiceRapportListRoute token={token} />}
              />
              <Route
                path="/wali/instructions"
                element={<WaliInstructionsPage token={token} />}
              />
              <Route
                path="/wali/instructions/new"
                element={<WaliInstructionCreatePage token={token} />}
              />
              <Route
                path="/wali/instructions/:id"
                element={<WaliInstructionDetailPage token={token} />}
              />
              <Route
                path="/wali/rapports"
                element={<WaliRapportsInboxPage token={token} />}
              />
              <Route
                path="/wali/rapports/:rapportId/view"
                element={<WaliRapportViewPage token={token} />}
              />
              <Route
                path="/wali/rapports/:rapportId/versions/:versionId?"
                element={<RapportVersionsArchivePage token={token} wali />}
              />
            </>
          ) : null}
          {me.role === "CHEF_CABINET" || me.role === "ADMIN" ? (
            <>
              <Route path="/chef" element={<ChefHubPage token={token} />} />
              <Route
                path="/chef/calendar"
                element={<WaliCalendarPage token={token} reviewer="chef" />}
              />
              <Route
                path="/chef/instructions"
                element={<ChefInstructionsPage token={token} />}
              />
              <Route
                path="/chef/instructions/:id"
                element={<ChefInstructionDetailPage token={token} />}
              />
              <Route
                path="/chef/office-users"
                element={<WaliOfficeUsersPage token={token} reviewer="chef" />}
              />
              <Route
                path="/chef/office-users/:userId/services/folder/:folderId"
                element={<ChefUserServicesRoute token={token} />}
              />
              <Route
                path="/chef/office-users/:userId/services"
                element={<ChefUserServicesRoute token={token} />}
              />
              <Route
                path="/chef/office-users/:userId/services/:serviceId"
                element={<ChefServiceRapportTypesRoute token={token} />}
              />
              <Route
                path="/chef/office-users/:userId/services/:serviceId/kinds/:contentKind"
                element={<ChefServiceKindRapportTypesRoute token={token} />}
              />
              <Route
                path="/chef/office-users/:userId/services/:serviceId/rapports/:rapportTypeId"
                element={<ChefServiceRapportListRoute token={token} />}
              />
              <Route
                path="/chef/rapports"
                element={<WaliRapportsInboxPage token={token} reviewer="chef" />}
              />
              <Route
                path="/chef/rapports/:rapportId/view"
                element={<WaliRapportViewPage token={token} audience="chef" />}
              />
              <Route
                path="/chef/rapports/:rapportId/versions/:versionId?"
                element={<RapportVersionsArchivePage token={token} chef />}
              />
            </>
          ) : null}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SnackbarProvider>
      <AppShell />
    </SnackbarProvider>
  );
}
