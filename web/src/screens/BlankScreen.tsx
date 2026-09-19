/**
 * 屏幕 7 - deliberately empty.
 *
 * The sketch lists this screen as "目前为空"; the route stays registered so the
 * screen exists in the app structure without pretending to hold content.
 */
import { TopAppBar } from '../components/layout';
import { useNav } from '../nav/navigation';

export default function BlankScreen() {
  const nav = useNav();
  return (
    <>
      <div className="screen-inner">
        <TopAppBar title="屏幕 7" onBack={() => nav.pop()} />
        <div className="screen-content" />
      </div>
    </>
  );
}
