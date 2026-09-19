/**
 * 设置 (Settings)
 *
 * A 5 item list group (M3 Expressive connected list: 3dp gaps, 28dp outer corners,
 * 8dp inner corners) with the switch and the two Expressive sliders stacked on top
 * of the group as the spec requires, plus a snackbar with 撤销 and the shared nav bar.
 */
import { useEffect, useRef, useState } from 'react';
import { AppNavBar, SectionHeader, TopAppBar } from '../components/layout';
import { MdIcon, MdIconButton, MdSlider, MdSwitch } from '../components/md';
import { useAppState } from '../state/AppState';
import { useNav } from '../nav/navigation';

const GITHUB_URL = 'https://github.com/tequed232/player';

export default function SettingsScreen() {
  const nav = useNav();
  const { settings, updateSettings, records, seed, dynamicColor } = useAppState();

  const [speechValue, setSpeechValue] = useState(settings.speechIntensity);
  const [cameraValue, setCameraValue] = useState(settings.cameraSharpness);
  const listRef = useRef<HTMLDivElement>(null);

  // keep the sliders in sync when settings are changed elsewhere (e.g. 撤销)
  useEffect(() => setSpeechValue(settings.speechIntensity), [settings.speechIntensity]);
  useEffect(() => setCameraValue(settings.cameraSharpness), [settings.cameraSharpness]);

  const apiConfigured = Boolean(settings.sttApiUrl.trim() || settings.visionApiUrl.trim());

  const toggleDarkMode = () => {
    updateSettings(
      { darkMode: !settings.darkMode },
      { message: settings.darkMode ? '已切换为浅色模式' : '已切换为深色模式' },
    );
  };

  const selectTab = (tab: 'home' | 'history' | 'settings') => {
    if (tab === 'home') {
      nav.popTo('home');
      return;
    }
    if (tab === 'settings') return;
    nav.push('history', {}, 'slide');
  };

  return (
    <>
      <div className="screen-inner">
        <TopAppBar title="设置" />

        <div className="screen-content">
          <div className="list-group" ref={listRef}>
            {/* ------------------------------------------------ 1 深色模式 */}
            <md-list-item type="button" className="rounded-outer-top" onClick={toggleDarkMode}>
              <div slot="start" className="list-icon-badge">
                <MdIcon name="dark_mode" />
              </div>
              <div slot="headline">深色模式</div>
              <div slot="supporting-text">
                {settings.darkMode ? '当前为深色模式' : '当前为浅色模式（默认设计目标）'}
              </div>
            </md-list-item>

            {/* ------------------------------------------------ 2 API编辑 */}
            <md-list-item
              type="button"
              className="rounded-middle"
              onClick={() => nav.push('apiEdit', {}, 'slide')}
            >
              <div slot="start" className="list-icon-badge">
                <MdIcon name="bolt" />
              </div>
              <div slot="headline">API编辑</div>
              <div slot="supporting-text">
                {apiConfigured ? '已配置接口，点击可修改' : '未配置，点击填写语音与图片接口'}
              </div>
              <MdIcon slot="end" name="chevron_right" />
            </md-list-item>

            {/* -------------------------------------- 3 语音输入强度调整 */}
            <md-list-item type="button" className="rounded-middle">
              <div slot="start" className="list-icon-badge">
                <MdIcon name="mic" />
              </div>
              <div slot="headline">语音输入强度调整</div>
              <div slot="supporting-text">识别置信度门限：{Math.round(speechValue)}%</div>
            </md-list-item>

            {/* -------------------------------------- 4 相机清晰度调整 */}
            <md-list-item type="button" className="rounded-middle">
              <div slot="start" className="list-icon-badge">
                <MdIcon name="camera_video" />
              </div>
              <div slot="headline">相机清晰度调整</div>
              <div slot="supporting-text">拍摄分辨率与画质：{Math.round(cameraValue)}%</div>
            </md-list-item>

            {/* ------------------------------------------------ 5 关于本软件 */}
            <md-list-item
              type="button"
              className="rounded-outer-bottom"
              onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}
            >
              <div slot="start" className="list-icon-badge">
                <MdIcon name="info" />
              </div>
              <div slot="headline">关于本软件</div>
              <div slot="supporting-text">在 GitHub 上查看项目（{GITHUB_URL}）</div>
              <MdIcon slot="end" name="chevron_right" />
            </md-list-item>

            {/* ------------------------- stacked controls (drawn in front) */}
            <div className="group-overlay" style={{ top: 20 }}>
              <MdSwitch
                selected={settings.darkMode}
                onSelectedChange={toggleDarkMode}
                ariaLabel="深色模式开关"
              />
            </div>

            <div className="group-overlay" style={{ top: 162, width: 168 }}>
              <MdSlider
                className="expressive-slider flex-1"
                value={speechValue}
                min={0}
                max={100}
                step={1}
                ariaLabel="语音输入强度"
                onInput={setSpeechValue}
                onChange={(value) => {
                  setSpeechValue(value);
                  updateSettings({ speechIntensity: value }, { message: '已保存语音输入强度' });
                }}
              />
              <span className="overlay-value md-label-medium">{Math.round(speechValue)}%</span>
            </div>

            <div className="group-overlay" style={{ top: 237, width: 168 }}>
              <MdSlider
                className="expressive-slider flex-1"
                value={cameraValue}
                min={0}
                max={100}
                step={1}
                ariaLabel="相机清晰度"
                onInput={setCameraValue}
                onChange={(value) => {
                  setCameraValue(value);
                  updateSettings({ cameraSharpness: value }, { message: '已保存相机清晰度' });
                }}
              />
              <span className="overlay-value md-label-medium">{Math.round(cameraValue)}%</span>
            </div>
          </div>

          <div className="mt-16">
            <SectionHeader icon="palette" title="外观与数据" />
            <div className="col gap-8">
              <div className="row gap-8">
                <MdIcon name="colorize" size={18} />
                <span className="md-body-medium flex-1">
                  {dynamicColor
                    ? `正在使用系统/浏览器提供的强调色生成 Material 3 配色（种子 ${seed.seed}，来源 ${seed.origin}）`
                    : `未获取到用户强调色，使用备用 Green 主题（种子 ${seed.seed}）`}
                </span>
              </div>
              <div className="row gap-8">
                <MdIcon name="storage" size={18} />
                <span className="md-body-medium flex-1">
                  全部数据保存在本机浏览器（IndexedDB），当前共有 {records.length} 条记录。
                </span>
              </div>
              <div className="row gap-8">
                <MdIcon name="motion_photos_on" size={18} />
                <span className="md-body-medium flex-1">
                  动效使用 MotionScheme.expressive() 弹簧曲线（spatial / effects 物理弹簧）。
                </span>
              </div>
            </div>
          </div>
        </div>

        <AppNavBar active="settings" onSelect={selectTab} />
      </div>
    </>
  );
}
