import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import * as api from "./api";
import {
  logoutRemote,
  onAccessTokenChange,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from "./auth/session";
import { queryClient } from "./query/queryClient";
import "./theme/tokens.css";
import "./App.css";
import { GuestLoginPage } from "./components/GuestLoginPage";
import { ChangeCodeModal } from "./components/ChangeCodeModal";
import { EditProfileModal } from "./components/EditProfileModal";
import { NotificationSettingsModal } from "./components/NotificationSettingsModal";
import { TopbarProfileMenu } from "./components/TopbarProfileMenu";
import { SnackbarProvider, useSnackbar } from "./snackbar/SnackbarContext";
import { AdminMunicipalitiesListPage } from "./pages/AdminMunicipalitiesListPage";
import { AdminDairasListPage } from "./pages/AdminDairasListPage";
import { AdminDirectionsListPage } from "./pages/AdminDirectionsListPage";
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
  OfficeDiscussionBell,
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
import { GuideVideosPage } from "./pages/GuideVideosPage";
import { ENABLE_GUIDE_VIDEOS } from "./config/features";

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
  const snack = useSnackbar();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<api.SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const [changeCodeOpen, setChangeCodeOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.removeItem("token");

    let cancelled = false;
    refreshSession()
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setToken(res.token);
          setMe(res.user);
          localStorage.setItem("me", JSON.stringify(res.user));
        } else {
          setToken(null);
          setMe(null);
          localStorage.removeItem("me");
        }
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      queryClient.clear();
      setToken(null);
      setMe(null);
      localStorage.removeItem("me");
      snack.show(t("sessionExpired"), "error");
      navigate("/");
    });
    onAccessTokenChange((next) => setToken(next));
    return () => {
      onSessionExpired(null);
      onAccessTokenChange(null);
    };
  }, [navigate, snack, t]);

  useEffect(() => {
    if (!token || !sessionReady) return;
    api
      .fetchMe(token)
      .then((r) => {
        setMe(r.user);
        localStorage.setItem("me", JSON.stringify(r.user));
      })
      .catch(() => {
        /* 401 handled by request() → notifySessionExpired */
      });
  }, [token, sessionReady]);

  useEffect(() => {
    if (!token || !sessionReady || !me || me.role === "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const { registerAppServiceWorker, refreshExistingPushSubscription } = await import(
          "./utils/webPush"
        );
        await registerAppServiceWorker();
        const prefs = await api.getNotificationPreferences(token);
        if (cancelled || !prefs.preferences.enabled || !prefs.preferences.push_enabled)
          return;
        // Upsert only if this browser already subscribed — never auto-create (use settings).
        await refreshExistingPushSubscription(token);
      } catch {
        /* soft-fail: push optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sessionReady, me?.id, me?.role]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "hub-counts-refresh") {
        import("./utils/hubCountsRefresh").then(
          ({ notifyHubCountsRefresh, notifyDiscussionRefresh }) => {
            void notifyHubCountsRefresh();
            // Prefer explicit discussion push; hub soft-sync covers missing fields / no-push.
            if (
              data.rapport_id != null &&
              Number(data.rapport_id) > 0 &&
              (data.message_key == null ||
                data.message_key === "rapportComment")
            ) {
              notifyDiscussionRefresh(Number(data.rapport_id));
            }
          },
        );
      }
      if (data.type === "navigate" && typeof data.url === "string") {
        navigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  function onLoginSuccess(res: api.LoginResponse) {
    setAccessToken(res.token);
    setToken(res.token);
    setMe(res.user);
    localStorage.setItem("me", JSON.stringify(res.user));
    navigate(hubPath(res.user.role));
  }

  async function logout() {
    await logoutRemote(token);
    queryClient.clear();
    setToken(null);
    setMe(null);
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

  if (!sessionReady) {
    return <div className="app guest" />;
  }

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
            <>
              <OfficeDiscussionBell token={token} />
              <OfficeNotificationsBell token={token} />
            </>
          ) : null}
          {me.role === "WALI" ? <WaliInboxBell token={token} /> : null}
          {me.role === "CHEF_CABINET" ? <ChefInboxBell token={token} /> : null}
          <TopbarProfileMenu
            user={me}
            lang={lang}
            onSetLang={setLang}
            onEditProfile={() => setEditProfileOpen(true)}
            onNotificationSettings={() => setNotifSettingsOpen(true)}
            onChangeCode={() => setChangeCodeOpen(true)}
            onLogout={logout}
          />
        </div>
      </header>
      <EditProfileModal
        token={token}
        open={editProfileOpen}
        user={me}
        onClose={() => setEditProfileOpen(false)}
        onSaved={(user) => {
          setMe(user);
          localStorage.setItem("me", JSON.stringify(user));
        }}
      />
      <NotificationSettingsModal
        token={token}
        open={notifSettingsOpen}
        user={me}
        onClose={() => setNotifSettingsOpen(false)}
      />
      <ChangeCodeModal
        token={token}
        open={changeCodeOpen}
        onClose={() => setChangeCodeOpen(false)}
        onChanged={() => {
          queryClient.clear();
          setAccessToken(null);
          setToken(null);
          setMe(null);
          localStorage.removeItem("me");
          navigate("/");
        }}
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
                element={<AdminDirectionsListPage token={token} />}
              />
              <Route path="/modiriyat" element={<Navigate to="/directions" replace />} />
              <Route path="/users" element={<AdminUsersPage token={token} currentUserId={me.id} isSuperAdmin={Boolean(me.is_super_admin)} />} />
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
              {ENABLE_GUIDE_VIDEOS ? (
                <Route
                  path="/admin/guide"
                  element={<GuideVideosPage token={token} listRole="admin" canManage={Boolean(me.is_super_admin)} />}
                />
              ) : null}
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
                path="/office/services/:serviceId/documents/new"
                element={<OfficeDocumentEditorPage token={token} />}
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
              {ENABLE_GUIDE_VIDEOS ? (
                <Route
                  path="/office/guide"
                  element={<GuideVideosPage token={token} listRole="office" />}
                />
              ) : null}
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
              {ENABLE_GUIDE_VIDEOS ? (
                <Route
                  path="/wali/guide"
                  element={<GuideVideosPage token={token} listRole="wali" />}
                />
              ) : null}
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
                path="/chef/shared"
                element={<OfficeSharedFilesPage token={token} audience="chef" />}
              />
              <Route
                path="/chef/shared/:id"
                element={<OfficeSharedFileDetailPage token={token} audience="chef" />}
              />
              {ENABLE_GUIDE_VIDEOS ? (
                <Route
                  path="/chef/guide"
                  element={<GuideVideosPage token={token} listRole="chef" />}
                />
              ) : null}
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
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <AppShell />
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
