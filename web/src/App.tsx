/** Application shell: the 412x892 phone stage, the screen stack and the snackbar. */
import { NavHost, useNav, type RouteName } from './nav/navigation';
import { SnackbarLayer } from './components/overlays';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import RecordDetailScreen from './screens/RecordDetailScreen';
import ApiEditScreen from './screens/ApiEditScreen';
import BlankScreen from './screens/BlankScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ScheduleFilterScreen from './screens/ScheduleFilterScreen';

const SCREENS = {
  home: HomeScreen,
  camera: CameraScreen,
  history: HistoryScreen,
  settings: SettingsScreen,
  record: RecordDetailScreen,
  apiEdit: ApiEditScreen,
  blank: BlankScreen,
  schedule: ScheduleScreen,
  scheduleFilter: ScheduleFilterScreen,
};

/** Screens that own a bottom navigation bar keep the snackbar 16dp above it. */
const WITH_NAV_BAR: RouteName[] = ['home', 'camera', 'history', 'settings', 'schedule'];

export default function App() {
  const { current } = useNav();
  const bottom = WITH_NAV_BAR.includes(current.route) ? 96 : 16;

  return (
    <div className="stage">
      <div className="phone">
        <NavHost screens={SCREENS} />
        <SnackbarLayer bottom={bottom} />
      </div>
    </div>
  );
}
