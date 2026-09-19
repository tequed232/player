/**
 * 课表 (schedule) - "四分课表"
 *
 * The schedule is embedded in the app (web/src/data/schedule.ts, generated from the
 * school's 学生课表.doc) and can be replaced by an imported file/pasted text.
 *
 * Layout: app bar (筛选 / 课表数据) → term + week stepper → the four day table with the
 * 早/中/晚 time axis (drag left/right to shift the four day window, tap a day to select
 * it, tap a course for details) → the selected day's timeline (expandable, address opens
 * the map) → nav bar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppNavBar, SectionHeader, TopAppBar, useScrolled } from '../components/layout';
import { MdIcon, MdIconButton } from '../components/md';
import {
  CourseDetailSheet,
  DayTimeline,
  FourDayBoard,
  MapChooserDialog,
  ScheduleImportSheet,
  highlightKeyFor,
} from '../components/schedule';
import { useAppState } from '../state/AppState';
import { useNav } from '../nav/navigation';
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  addDays,
  activeWeekdays,
  coursesOfDay,
  formatMonthDay,
  mapProviderById,
  parseISODate,
  startOfWeek,
  weekNumberFor,
  weekdayIndex,
  type ScheduleCourse,
  type ScheduleData,
  type SchedulePeriod,
} from '../lib/schedule';

interface CoursePayload {
  course: ScheduleCourse;
  period: SchedulePeriod;
  dayIndex: number;
}

/** The four day window that contains today (Monday aligned when possible). */
function windowForDate(date: Date): Date {
  const index = weekdayIndex(date);
  return index <= 3 ? startOfWeek(date) : addDays(startOfWeek(date), index - 3);
}

/** Today when it has courses, otherwise the closest day inside the window. */
function initialSelection(windowStart: Date, schedule: ScheduleData, week: number, today: Date): Date {
  if (coursesOfDay(schedule, weekdayIndex(today), week).length) return today;
  for (let offset = 0; offset < 4; offset += 1) {
    const candidate = addDays(windowStart, offset);
    if (coursesOfDay(schedule, weekdayIndex(candidate), week).length) return candidate;
  }
  const active = activeWeekdays(schedule);
  return active.length ? addDays(startOfWeek(today), active[0]) : today;
}

export default function ScheduleScreen() {
  const nav = useNav();
  const {
    schedule,
    settings,
    updateSettings,
    scheduleImported,
    scheduleHighlight,
    setScheduleHighlight,
    showSnackbar,
  } = useAppState();
  const termStart = settings.termStart || schedule.termStart;

  const today = useMemo(() => new Date(), []);
  const [windowStart, setWindowStart] = useState(() => windowForDate(today));
  const [selectedDate, setSelectedDate] = useState(() =>
    initialSelection(windowForDate(today), schedule, weekNumberFor(today, settings.termStart || schedule.termStart), today),
  );
  const [payload, setPayload] = useState<CoursePayload | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [mapChooser, setMapChooser] = useState<{ address: string; course: ScheduleCourse } | null>(null);
  const { ref: scrollRef, scrolled } = useScrolled<HTMLDivElement>();

  const week = weekNumberFor(selectedDate, termStart);
  const dayIndex = weekdayIndex(selectedDate);

  /* highlight coming back from the filter screen */
  useEffect(() => {
    if (!scheduleHighlight) return undefined;
    const remaining = scheduleHighlight.until - Date.now();
    if (remaining <= 0) {
      setScheduleHighlight(null);
      return undefined;
    }
    // jump to the week the course actually runs in, then to that weekday
    const target = scheduleHighlight.week
      ? addDays(addDays(startOfWeek(parseISODate(termStart)), (scheduleHighlight.week - 1) * 7), scheduleHighlight.dayIndex)
      : addDays(startOfWeek(selectedDate), scheduleHighlight.dayIndex);
    setSelectedDate(target);
    setWindowStart(windowForDate(target));
    const timer = window.setTimeout(() => setScheduleHighlight(null), remaining);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleHighlight]);

  /* when the schedule changes, keep the window on a day that has courses */
  useEffect(() => {
    const active = activeWeekdays(schedule);
    if (!active.length) return;
    if (!active.includes(weekdayIndex(selectedDate))) {
      const next = addDays(startOfWeek(selectedDate), active[0]);
      setSelectedDate(next);
      setWindowStart(windowForDate(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const openCourse = (next: CoursePayload) => {
    setPayload(next);
    setDetailOpen(true);
  };

  const openNavigation = (address: string, course: ScheduleCourse) => {
    const provider = mapProviderById(settings.mapProvider);
    if (provider) {
      window.open(provider.url(address), '_blank', 'noopener,noreferrer');
      showSnackbar({ message: `已在${provider.label}中搜索「${address}」`, duration: 4000 });
      return;
    }
    setMapChooser({ address, course });
  };

  const shiftWindow = (days: number) => {
    setWindowStart((value) => addDays(value, days));
  };

  const shiftWeek = (weeks: number) => {
    setWindowStart((value) => addDays(value, weeks * 7));
    setSelectedDate((value) => addDays(value, weeks * 7));
  };

  const goToday = () => {
    setSelectedDate(today);
    setWindowStart(windowForDate(today));
  };

  const selectTab = (tab: 'home' | 'history' | 'schedule' | 'settings') => {
    if (tab === 'schedule') return;
    if (tab === 'home') {
      nav.popTo('home');
      return;
    }
    nav.push(tab === 'history' ? 'history' : 'settings', {}, 'slide');
  };

  const todayCount = coursesOfDay(schedule, weekdayIndex(today), weekNumberFor(today, termStart)).length;

  return (
    <>
      <div className="screen-inner">
        <TopAppBar
          title="四分课表"
          scrolled={scrolled}
          leading={<MdIconButton icon="search_check_2" label="筛选课程" onClick={() => nav.push('scheduleFilter', {}, 'slide')} />}
          actions={
            <>
              <MdIconButton
                icon="today"
                label="回到今天"
                onClick={goToday}
              />
              <MdIconButton icon="edit" label="课表数据与导入" onClick={() => setImportOpen(true)} />
            </>
          }
        />

        <div className="screen-content" ref={scrollRef} style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="schedule-head">
            <div className="schedule-meta md-body-small">
              <MdIcon name="calendar_month" size={16} />
              <span>
                {schedule.term} · 第 {week} 教学周
              </span>
              <span className="flex-1" />
              <span>{scheduleImported ? '已导入课表' : '内置课表'}</span>
              <span>{schedule.owner}</span>
            </div>

            <div className="week-stepper">
              <MdIconButton icon="chevron_left" label="上一周" onClick={() => shiftWeek(-1)} />
              <span className="week-label md-title-small-emphasized">
                第 {week} 周 · {formatMonthDay(addDays(windowStart, 3))} 止
              </span>
              <MdIconButton icon="chevron_right" label="下一周" onClick={() => shiftWeek(1)} />
            </div>
          </div>

          <FourDayBoard
            schedule={schedule}
            windowStart={windowStart}
            selectedDate={selectedDate}
            week={week}
            highlightKey={scheduleHighlight?.key ?? null}
            onSelectDay={setSelectedDate}
            onShiftWindow={shiftWindow}
            onOpenCourse={openCourse}
          />

          <div className="md-body-small muted" style={{ padding: '8px 16px 0' }}>
            左右滑动表格切换日期 · 点击课程查看教师与地点 · 今天 {WEEKDAY_SHORT[weekdayIndex(today)]} 共 {todayCount} 门课
          </div>

          <div style={{ padding: '12px 16px 0' }}>
            <SectionHeader
              icon="event_note"
              title={`${WEEKDAY_LONG[dayIndex]} · ${formatMonthDay(selectedDate)}`}
              trailing={
                <span className="md-label-medium muted">
                  第 {week} 周 · {coursesOfDay(schedule, dayIndex, week).length} 门课
                </span>
              }
            />
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <DayTimeline
              schedule={schedule}
              date={selectedDate}
              week={week}
              highlightKey={scheduleHighlight?.key ?? null}
              onOpenCourse={openCourse}
              onNavigate={openNavigation}
            />
          </div>
        </div>

        <AppNavBar active="schedule" onSelect={selectTab} />
      </div>

      <CourseDetailSheet
        open={detailOpen}
        payload={payload}
        onClose={() => setDetailOpen(false)}
        onNavigate={(address, course) => {
          setDetailOpen(false);
          openNavigation(address, course);
        }}
      />

      <ScheduleImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          setImportOpen(false);
          showSnackbar({ message });
        }}
      />

      <MapChooserDialog
        open={Boolean(mapChooser)}
        address={mapChooser?.address ?? ''}
        onCancel={() => setMapChooser(null)}
        onConfirm={(providerId, remember) => {
          const provider = mapProviderById(providerId);
          const address = mapChooser?.address ?? '';
          if (remember) {
            updateSettings({ mapProvider: providerId }, { message: `已把${provider?.label ?? '地图'}设为默认` });
          }
          setMapChooser(null);
          if (provider && address) {
            window.open(provider.url(address), '_blank', 'noopener,noreferrer');
            showSnackbar({ message: `已在${provider.label}中搜索「${address}」`, duration: 4000 });
          }
        }}
      />
    </>
  );
}
