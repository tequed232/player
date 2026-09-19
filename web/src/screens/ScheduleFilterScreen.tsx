/**
 * 筛选 (schedule filter)
 *
 * Tabs: 老师 / 课程 / 地点 / 时间. Search across the embedded schedule, list the hits
 * as 课程 · 老师 · 地点 rows, and jump back to the schedule screen highlighting the
 * chosen course for a few seconds (per the design note). The 地点 tab shows the map
 * panel that hands the address over to the default map app.
 */
import { useEffect, useMemo, useState } from 'react';
import { SectionHeader, TopAppBar } from '../components/layout';
import { MdIcon, MdIconButton, MdMenu, MdTabs, MdTextField, type MenuAction } from '../components/md';
import { MapChooserDialog, highlightKeyFor } from '../components/schedule';
import { useAppState } from '../state/AppState';
import { useNav } from '../nav/navigation';
import { useSpeechRecognition } from '../lib/speech';
import {
  WEEKDAY_LONG,
  formatAddress,
  mapProviderById,
  openMapLink,
  parseISODate,
  searchSchedule,
  targetWeekFor,
  toISODate,
  weekNumberFor,
  weekdayIndex,
  type SearchField,
  type SearchHit,
} from '../lib/schedule';

const TABS = ['老师', '课程', '地点', '时间'] as const;
const FIELDS: SearchField[] = ['teacher', 'course', 'place', 'course'];

export default function ScheduleFilterScreen() {
  const nav = useNav();
  const { schedule, settings, updateSettings, setScheduleHighlight, showSnackbar } = useAppState();

  const [tabIndex, setTabIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [mapChooser, setMapChooser] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const speech = useSpeechRecognition({
    intensity: settings.speechIntensity,
    onFinal: (text) => setQuery((value) => `${value}${value ? ' ' : ''}${text.trim()}`),
    onError: (message) => showSnackbar({ message, duration: 5000 }),
  });

  const hits = useMemo(() => {
    const field = FIELDS[tabIndex];
    const all = searchSchedule(schedule, tabIndex === 3 ? '' : query, field);
    if (tabIndex !== 3) return all;
    const index = weekdayIndex(parseISODate(date));
    return all.filter((hit) => hit.dayIndex === index);
  }, [schedule, query, tabIndex, date]);

  useEffect(() => {
    speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIndex]);

  const openHit = (hit: SearchHit) => {
    const termStart = settings.termStart || schedule.termStart;
    const currentWeek = weekNumberFor(new Date(), termStart);
    const week = targetWeekFor(hit.course, currentWeek);
    setScheduleHighlight({
      key: highlightKeyFor(hit.course, hit.dayIndex),
      dayIndex: hit.dayIndex,
      week,
      until: Date.now() + 5000,
    });
    if (week && week !== currentWeek) {
      showSnackbar({ message: `${hit.course.name} 在第 ${week} 周开课，已切换到该周`, duration: 5000 });
    }
    nav.popTo('schedule');
  };

  const openMap = (address: string) => {
    if (!address) {
      showSnackbar({ message: '该课程没有填写地点', duration: 4000 });
      return;
    }
    setMapChooser(address);
  };

  const menuActions: MenuAction[] = [
    {
      label: '清空筛选条件',
      icon: 'filter_list_off',
      onSelect: () => {
        setQuery('');
        setMenuOpen(false);
      },
    },
    {
      label: '回到今天',
      icon: 'today',
      onSelect: () => {
        setDate(toISODate(new Date()));
        setMenuOpen(false);
      },
    },
  ];

  return (
    <>
      <div className="screen-inner">
        <TopAppBar
          title="筛选"
          onBack={() => nav.pop()}
          backLabel="返回课表"
          actions={
            <MdIconButton
              icon="more_vert"
              label="更多操作"
              onClick={(event) => {
                setMenuAnchor(event.currentTarget);
                setMenuOpen(true);
              }}
            />
          }
        />

        <div className="screen-content">
          <MdTabs tabs={[...TABS]} activeIndex={tabIndex} onChange={setTabIndex} />

          {tabIndex === 3 ? (
            <div className="col gap-8 mt-12">
              <div className="md-title-small-emphasized">按日期筛选</div>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                style={{
                  height: 56,
                  borderRadius: 16,
                  border: '1px solid var(--md-sys-color-outline)',
                  background: 'var(--md-sys-color-surface)',
                  color: 'var(--md-sys-color-on-surface)',
                  padding: '0 16px',
                  fontFamily: 'var(--md-ref-typeface-brand)',
                  fontSize: 16,
                }}
              />
              <div className="md-body-small muted">
                {date} 是{WEEKDAY_LONG[weekdayIndex(parseISODate(date))]}，下面列出当天全部课程。
              </div>
            </div>
          ) : (
            <div className="mt-12">
              <MdTextField
                label={`搜索${TABS[tabIndex]}`}
                value={query}
                onValueChange={setQuery}
                placeholder={tabIndex === 0 ? '教师姓名' : tabIndex === 1 ? '课程名称' : '上课地点'}
                leadingIcon={<MdIcon name="search" />}
                trailingIcon={
                  <MdIconButton
                    icon={speech.listening ? 'stop_circle' : 'mic'}
                    label={speech.listening ? '停止语音输入' : '语音输入搜索词'}
                    onClick={() => speech.toggle()}
                  />
                }
              />
            </div>
          )}

          {tabIndex === 2 && selected ? (
            <div className="mt-12">
              <div className="map-preview">
                <div className="row gap-8">
                  <MdIcon name="map" size={20} />
                  <span className="md-title-small-emphasized flex-1">{selected.course.room || '未填写地点'}</span>
                </div>
                <div className="md-body-small">
                  地图面板仅用于把所选地点交给第三方地图应用继续筛选地址，不内嵌地图数据。
                </div>
                <div>
                  <md-filled-tonal-button onClick={() => openMap(selected.course.room)}>
                    <MdIcon slot="icon" name="navigation" />
                    打开地图导航
                  </md-filled-tonal-button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-16">
            <SectionHeader
              icon="list_alt"
              title={`结果 ${hits.length} 条`}
              trailing={<span className="md-label-medium muted">{TABS[tabIndex]}</span>}
            />
            {hits.length ? (
              <>
                <div className="filter-head md-label-medium">
                  <span>课程</span>
                  <span>老师</span>
                  <span>地点</span>
                </div>
                {hits.map((hit) => (
                  <div
                    className="filter-row"
                    key={`${hit.course.name}-${hit.course.teacher}-${hit.course.room}-${hit.dayIndex}-${hit.period}`}
                    onClick={() => {
                      setSelected(hit);
                      openHit(hit);
                    }}
                  >
                    <div className="col">
                      <span className="col-name md-body-medium">{hit.course.name}</span>
                      <span className="md-label-small muted">
                        {WEEKDAY_LONG[hit.dayIndex]} · {hit.period}
                      </span>
                    </div>
                    <span className="md-body-small">{hit.course.teacher || '—'}</span>
                    <span className="md-body-small">{hit.course.room || '—'}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="empty-state" style={{ padding: '24px 8px' }}>
                <div className="empty-icon">
                  <MdIcon name="search_off" size={32} />
                </div>
                <div className="md-title-small" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  没有匹配的课程
                </div>
                <div className="md-body-small">换一个关键词，或切到「时间」按日期查看。</div>
              </div>
            )}
          </div>

          <div className="md-body-small muted mt-16">
            点击任意结果会回到课表并高亮该课程 5 秒。
          </div>
        </div>
      </div>

      <MdMenu anchor={menuAnchor} open={menuOpen} actions={menuActions} onClose={() => setMenuOpen(false)} />

      <MapChooserDialog
        open={Boolean(mapChooser)}
        address={mapChooser ?? ''}
        onCancel={() => setMapChooser(null)}
        onConfirm={(providerId, remember) => {
          const address = mapChooser ?? '';
          if (remember) updateSettings({ mapProvider: providerId }, { message: '已保存默认地图' });
          setMapChooser(null);
          const provider = mapProviderById(providerId);
          if (provider && address) {
            const full = formatAddress(address, settings.schoolName);
            const mode = openMapLink(provider, full);
            showSnackbar({
              message: mode === 'app' ? `正在唤起${provider.label}…` : `已在${provider.label}中搜索「${full}」`,
              duration: 4000,
            });
          }
        }}
      />
    </>
  );
}
