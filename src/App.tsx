import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useArcStatus } from './store/ArcStatusContext';
import { Onboarding } from './ui/onboarding/Onboarding';
import { AppShell } from './ui/AppShell';
import { Today } from './ui/screens/Today';
import { Progress } from './ui/screens/Progress';
import { Skills } from './ui/screens/Skills';
import { Profile } from './ui/screens/Profile';
import { BodyDetailScreen } from './ui/screens/BodyDetailScreen';
import { MindDetailScreen } from './ui/screens/MindDetailScreen';
import { CraftDetailScreen } from './ui/screens/CraftDetailScreen';
import { SHORTCUT_ROUTES, OPEN_PARAM, type OpenTarget } from './ui/routing/shortcuts';
import { Splash, SPLASH_MIN_MS, useMinimumElapsed } from './ui/boot/Splash';
import { Start } from './ui/boot/Start';
import { SettingsScreen } from './ui/settings/SettingsScreen';
import { AppearanceScreen } from './ui/settings/AppearanceScreen';
import { AboutScreen } from './ui/settings/AboutScreen';
import { SystemScreen, ReminderScreen } from './ui/settings/SystemScreen';
import { DataScreen } from './ui/settings/DataScreen';

function RequireArc({ arcExists }: { arcExists: boolean }) {
  if (!arcExists) {
    return <Navigate to="/start" replace />;
  }
  return <Outlet />;
}

/**
 * Resolves a PWA app-shortcut to Today with the right surface requested.
 *
 * `replace` matters here: the shortcut URL is a launcher entry point,
 * not somewhere the user navigated, so it must not sit in the history
 * stack waiting for a back gesture to return to it.
 */
function Shortcut({ target, arcExists }: { target: OpenTarget; arcExists: boolean }) {
  if (!arcExists) {
    return <Navigate to="/start" replace />;
  }
  return <Navigate to={`/today?${OPEN_PARAM}=${target}`} replace />;
}

export function App() {
  const { status, markArcCreated } = useArcStatus();
  const bootHeld = useMinimumElapsed(SPLASH_MIN_MS);

  // The splash stays until the arc status resolves AND the minimum has
  // elapsed. Waiting on both means a slow device never gets a truncated
  // boot and a fast one never gets a flash.
  if (status === 'loading' || !bootHeld) {
    return <Splash />;
  }

  const arcExists = status === 'yes';

  return (
    <Routes>
      {/* The front door: where every path lands when no arc exists. */}
      <Route
        path="/start"
        element={arcExists ? <Navigate to="/today" replace /> : <Start />}
      />

      <Route
        path="/onboarding"
        element={
          arcExists ? <Navigate to="/today" replace /> : <Onboarding onComplete={markArcCreated} />
        }
      />

      {/* Declared in the manifest since Slice 1; unhandled until now. */}
      {SHORTCUT_ROUTES.map(({ path, target }) => (
        <Route key={path} path={path} element={<Shortcut target={target} arcExists={arcExists} />} />
      ))}

      <Route element={<RequireArc arcExists={arcExists} />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="progress" element={<Progress />} />
          <Route path="skills" element={<Skills />} />
          <Route path="profile" element={<Profile />} />

          {/* Attribute detail screens */}
          <Route path="attributes/body" element={<BodyDetailScreen />} />
          <Route path="attributes/mind" element={<MindDetailScreen />} />
          <Route path="attributes/craft" element={<CraftDetailScreen />} />
          {/* Child routes of the profile tab, not modals — design/02
              §3.2. The bottom nav stays visible the whole way down, so
              the four-tab contract is never broken by going deeper. */}
          <Route path="profile/settings" element={<SettingsScreen />} />
          <Route path="profile/settings/appearance" element={<AppearanceScreen />} />
          <Route path="profile/settings/system" element={<SystemScreen />} />
          <Route path="profile/settings/system/:questKey" element={<ReminderScreen />} />
          <Route path="profile/settings/data" element={<DataScreen />} />
          <Route path="profile/settings/about" element={<AboutScreen />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={arcExists ? '/today' : '/start'} replace />} />
    </Routes>
  );
}
