/**
 * 课表 (schedule) building blocks:
 *  - FourDayBoard: the four day table with a 早/中/晚 time axis, drag to shift the
 *    four day window (跟手), tap a day to select it, tap a course for details.
 *  - DayTimeline: the selected day's courses grouped by 上午/中午/下午/晚上.
 *  - CourseDetailSheet / MapChooserDialog / ScheduleImportSheet.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MdIcon, MdIconButton, MdTextField } from './md';
import { ExpandableSheet } from './overlays';
import {
  MAP_PROVIDERS,
  SCHEDULE_SECTIONS,
  WEEKDAY_SHORT,
  addDays,
  courseKey,
  courseWeekLabel,
  coursesOfDay,
  formatMonthDay,
  isSameDay,
  mapProviderById,
  parseScheduleFile,
  parseTextSchedule,
  type DayCourse,
  type ScheduleCourse,
  type ScheduleData,
  type SchedulePeriod,
  type ScheduleSection,
} from '../lib/schedule';
import { useAppState } from '../state/AppState';
import { pickFile } from '../lib/imaging';

/* --------------------------------------------------------------- helpers --- */

/** Stable tone per course so the same class keeps the same container color. */
function toneOf(course: ScheduleCourse): 0 | 1 | 2 {
  let hash = 0;
  for (let i = 0; i < course.name.length; i += 1) hash = (hash * 31 + course.name.charCodeAt(i)) % 997;
  return (hash % 3) as 0 | 1 | 2;
}

export function highlightKeyFor(course: ScheduleCourse, dayIndex: number): string {
  return `${courseKey(course)}#${dayIndex}`;
}

/* ---------------------------------------------------------- four day board -- */

export function FourDayBoard({
  schedule,
  windowStart,
  selectedDate,
  week,
  highlightKey,
  onSelectDay,
  onShiftWindow,
  onOpenCourse,
}: {
  schedule: ScheduleData;
  /** first of the four days shown */
  windowStart: Date;
  selectedDate: Date;
  week: number;
  highlightKey?: string | null;
  onSelectDay: (date: Date) => void;
  onShiftWindow: (deltaDays: number) => void;
  onOpenCourse: (payload: { course: ScheduleCourse; period: SchedulePeriod; dayIndex: number }) => void;
}) {
  const today = new Date();
  const days = useMemo(() => [0, 1, 2, 3].map((offset) => addDays(windowStart, offset)), [windowStart]);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const captured = useRef(false);
  const moved = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX.current = event.clientX;
    captured.current = false;
    moved.current = false;
    // NOTE: pointer capture is taken only once a real drag starts, otherwise the
    // click would be retargeted to the board and course chips would never open.
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const raw = event.clientX - startX.current;
    if (!moved.current) {
      if (Math.abs(raw) < 8) return;
      moved.current = true;
      setDragging(true);
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      captured.current = true;
    }
    const width = boardRef.current?.clientWidth ?? 360;
    // resistance beyond a quarter of the board width
    const limit = width / 4;
    setOffset(Math.max(-limit, Math.min(limit, raw)));
  };

  const endDrag = () => {
    if (!moved.current) {
      captured.current = false;
      return;
    }
    const width = boardRef.current?.clientWidth ?? 360;
    const threshold = Math.max(36, width / 12);
    if (offset <= -threshold) onShiftWindow(1);
    else if (offset >= threshold) onShiftWindow(-1);
    setOffset(0);
    setDragging(false);
    moved.current = false;
    captured.current = false;
  };

  // group the periods by 早 / 中 / 晚 so the axis can label each block once
  const blocks = useMemo(() => {
    const result: { section: ScheduleSection; periods: SchedulePeriod[] }[] = [];
    for (const period of schedule.periods) {
      const last = result[result.length - 1];
      if (last && last.section === period.section) last.periods.push(period);
      else result.push({ section: period.section, periods: [period] });
    }
    return result;
  }, [schedule.periods]);

  return (
    <div
      className="sched-board"
      ref={boardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => dragging && endDrag()}
      role="group"
      aria-label="四日课表，可左右滑动切换日期"
    >
      <div
        className="sched-track"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging
            ? 'none'
            : 'transform var(--md-sys-motion-spring-spatial-fast-duration, 350ms) var(--md-sys-motion-spring-spatial-fast, ease-out)',
        }}
      >
        <div className="sched-grid">
          <div className="sched-corner row" style={{ justifyContent: 'center' }}>
            <MdIcon name="schedule" size={18} />
          </div>
          {days.map((date) => {
            const index = (date.getDay() + 6) % 7;
            const classes = ['sched-day-head'];
            if (isSameDay(date, today)) classes.push('today');
            if (isSameDay(date, selectedDate)) classes.push('selected');
            return (
              <div className={classes.join(' ')} key={date.toISOString()} onClick={() => onSelectDay(date)}>
                <span className="day-name md-label-large-emphasized">{WEEKDAY_SHORT[index]}</span>
                <span className="md-label-small">{formatMonthDay(date)}</span>
              </div>
            );
          })}

          {blocks.map((block) => (
            <div className="sched-block" key={block.section}>
              <div className="sched-section">
                <span className="md-label-medium-emphasized">
                  {SCHEDULE_SECTIONS.find((section) => section.id === block.section)?.label}
                </span>
                <span className="sched-section-rule" />
              </div>
              <div className="sched-grid">
                {block.periods.map((period) => (
                  <div key={period.period} style={{ display: 'contents' }}>
                    <div className="sched-axis-cell">
                      <div className="md-label-small-emphasized">{period.period.replace('第', '').replace('节', '')}</div>
                      <div className="md-label-small" style={{ opacity: 0.75 }}>
                        {period.time.split('-')[0]}
                      </div>
                    </div>
                    {days.map((date) => {
                      const dayIndex = (date.getDay() + 6) % 7;
                      const courses = (period.days[dayIndex] ?? []).filter(
                        (course) => !course.weeks || parseWeekSetSafe(course.weeks).size === 0 || parseWeekSetSafe(course.weeks).has(week),
                      );
                      return (
                        <div className="sched-cell" key={`${period.period}-${dayIndex}`}>
                          {courses.length ? (
                            courses.map((course) => {
                              const tone = toneOf(course);
                              const highlighted = highlightKey === highlightKeyFor(course, dayIndex);
                              return (
                                <button
                                  type="button"
                                  key={`${course.name}-${course.teacher}-${course.room}`}
                                  className={`course-chip${tone ? ` tone-${tone}` : ''}${highlighted ? ' highlight' : ''}`}
                                  onClick={() => onOpenCourse({ course, period, dayIndex })}
                                >
                                  {course.name}
                                </button>
                              );
                            })
                          ) : (
                            <div className="sched-empty">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function parseWeekSetSafe(spec: string): Set<number> {
  const weeks = new Set<number>();
  for (const part of spec.replace(/周/g, '').split(/[;,，、\s]+/)) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) {
      for (let week = Number(range[1]); week <= Number(range[2]); week += 1) weeks.add(week);
    } else if (/^\d+$/.test(part)) weeks.add(Number(part));
  }
  return weeks;
}

/* ------------------------------------------------------------ day timeline -- */

export function DayTimeline({
  schedule,
  date,
  week,
  onOpenCourse,
  onNavigate,
  highlightKey,
}: {
  schedule: ScheduleData;
  date: Date;
  week: number;
  onOpenCourse: (payload: { course: ScheduleCourse; period: SchedulePeriod; dayIndex: number }) => void;
  onNavigate: (address: string, course: ScheduleCourse) => void;
  highlightKey?: string | null;
}) {
  const dayIndex = (date.getDay() + 6) % 7;
  const entries = coursesOfDay(schedule, dayIndex, week);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!entries.length) {
    return (
      <div className="empty-state" style={{ padding: '24px 16px' }}>
        <div className="empty-icon">
          <MdIcon name="event_available" size={32} />
        </div>
        <div className="md-title-small" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          这一天没有课程
        </div>
        <div className="md-body-small">第 {week} 周 · {WEEKDAY_SHORT[dayIndex]} {formatMonthDay(date)}</div>
      </div>
    );
  }

  return (
    <div>
      {SCHEDULE_SECTIONS.map((section) => {
        const sectionEntries = entries.filter((entry) => entry.section === section.id);
        if (!sectionEntries.length) return null;
        return (
          <div key={section.id}>
            <div className="timeline-section-label">
              <span className="md-label-medium-emphasized">{section.label}</span>
              <span className="rule" />
            </div>
            {sectionEntries.map((entry) => {
              const key = `${entry.period}-${courseKey(entry.course)}`;
              const isOpen = expanded === key;
              const highlighted = highlightKey === highlightKeyFor(entry.course, dayIndex);
              const period = schedule.periods[entry.periodIndex];
              return (
                <div
                  className="timeline-item"
                  key={key}
                  onClick={() => onOpenCourse({ course: entry.course, period, dayIndex })}
                  style={highlighted ? { outline: '2px solid var(--md-sys-color-primary)' } : undefined}
                >
                  <div className="timeline-time">
                    <div className="md-label-small-emphasized">{entry.period.replace('第', '').replace('节', '')}</div>
                    <div className="md-label-small" style={{ opacity: 0.75 }}>
                      {entry.time.split('-')[0]}
                    </div>
                  </div>
                  <div className="timeline-body">
                    <div className="row gap-8">
                      <span className="md-title-small-emphasized flex-1">{entry.course.name}</span>
                      <MdIconButton
                        icon={isOpen ? 'expand_less' : 'expand_more'}
                        label={isOpen ? '收起课程信息' : '展开课程信息'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpanded(isOpen ? null : key);
                        }}
                      />
                    </div>
                    <div className="row gap-8 muted md-body-small">
                      <MdIcon name="person" size={14} />
                      <span>{entry.course.teacher || '未填写教师'}</span>
                      <MdIcon name="repeat" size={14} />
                      <span>{courseWeekLabel(entry.course)}</span>
                    </div>
                    {isOpen ? (
                      <div className="timeline-details">
                        <div className="timeline-detail-row md-body-small">
                          <MdIcon name="schedule" size={16} />
                          <span>
                            {entry.period} · {entry.time}
                          </span>
                        </div>
                        <div className="timeline-detail-row md-body-small">
                          <MdIcon name="groups" size={16} />
                          <span>{entry.course.className || '—'}</span>
                        </div>
                        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <MdIcon name="place" size={16} />
                          <span className="md-body-small muted">{entry.course.room || '未填写地点'}</span>
                          {entry.course.room ? (
                            <button
                              type="button"
                              className="address-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onNavigate(entry.course.room, entry.course);
                              }}
                            >
                              <MdIcon name="navigation" size={16} />
                              导航前往
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- course detail sheet */

export function CourseDetailSheet({
  open,
  payload,
  onClose,
  onNavigate,
}: {
  open: boolean;
  payload: { course: ScheduleCourse; period: SchedulePeriod; dayIndex: number } | null;
  onClose: () => void;
  onNavigate: (address: string, course: ScheduleCourse) => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const course = payload?.course;
  return (
    <ExpandableSheet open={open} onClose={onClose} sourceRef={sourceRef} icon="event" title={course?.name ?? '课程'}>
      <div ref={sourceRef} />
      {course ? (
        <div className="col gap-12">
          <div className="row gap-8">
            <MdIcon name="schedule" size={18} />
            <span className="md-body-medium">
              {WEEKDAY_SHORT[payload!.dayIndex]} · {payload!.period.period} · {payload!.period.time}
            </span>
          </div>
          <div className="row gap-8">
            <MdIcon name="person" size={18} />
            <span className="md-body-medium">{course.teacher || '未填写教师'}</span>
          </div>
          <div className="row gap-8">
            <MdIcon name="groups" size={18} />
            <span className="md-body-medium">{course.className || '—'}</span>
          </div>
          <div className="row gap-8">
            <MdIcon name="repeat" size={18} />
            <span className="md-body-medium">{courseWeekLabel(course)}</span>
          </div>
          <div className="row gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <MdIcon name="place" size={18} />
            <span className="md-body-medium flex-1">{course.room || '未填写地点'}</span>
            {course.room ? (
              <md-filled-tonal-button onClick={() => onNavigate(course.room, course)}>
                <MdIcon slot="icon" name="navigation" />
                导航
              </md-filled-tonal-button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ExpandableSheet>
  );
}

/* --------------------------------------------------------- map chooser ----- */

export function MapChooserDialog({
  open,
  address,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  address: string;
  onCancel: () => void;
  onConfirm: (providerId: string, remember: boolean) => void;
}) {
  const [selected, setSelected] = useState(MAP_PROVIDERS[0].id);
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    if (open) {
      setSelected(MAP_PROVIDERS[0].id);
      setRemember(false);
    }
  }, [open]);

  return (
    <md-dialog open={open ? '' : undefined} onCancel={onCancel} className="app-dialog">
      <div slot="headline">选择地图应用</div>
      <div slot="content" className="md-body-medium">
        <div className="mb-8 muted">将为「{address}」启动导航</div>
        {MAP_PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            className={`map-option${selected === provider.id ? ' selected' : ''}`}
            onClick={() => setSelected(provider.id)}
          >
            <MdIcon name={selected === provider.id ? 'radio_button_checked' : 'radio_button_unchecked'} />
            <div className="col flex-1">
              <span className="md-title-small-emphasized">{provider.label}</span>
              <span className="md-body-small">{provider.hint}</span>
            </div>
          </div>
        ))}
        <label className="row gap-8 mt-12" style={{ alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--md-sys-color-primary)' }}
          />
          <span className="md-body-medium">记住选择（写入设置，之后不再询问）</span>
        </label>
      </div>
      <div slot="actions">
        <md-text-button onClick={onCancel}>取消</md-text-button>
        <md-text-button onClick={() => onConfirm(selected, remember)}>打开地图</md-text-button>
      </div>
    </md-dialog>
  );
}

/* ------------------------------------------------------ schedule import ---- */

export function ScheduleImportSheet({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const { settings, updateSettings, setSchedule, schedule, scheduleImported, showSnackbar } = useAppState();
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [termStart, setTermStart] = useState(settings.termStart || schedule.termStart);

  useEffect(() => {
    if (open) setTermStart(settings.termStart || schedule.termStart);
  }, [open, settings.termStart, schedule.termStart]);

  const importFile = async () => {
    const file = await pickFile('课表文件', '.doc,.rtf,.html,.htm,.csv,.txt,.tsv,application/msword,text/rtf,text/html');
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseScheduleFile(file);
      setSchedule(parsed);
      onImported(`已导入 ${file.name}：${parsed.periods.length} 个节次`);
    } catch (error) {
      showSnackbar({ message: `课表解析失败：${error instanceof Error ? error.message : '未知错误'}`, duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const importText = () => {
    if (!pasted.trim()) {
      showSnackbar({ message: '请先粘贴课表文本', duration: 4000 });
      return;
    }
    try {
      const parsed = parseTextSchedule(pasted);
      setSchedule(parsed);
      setPasted('');
      onImported(`已从文本导入：${parsed.periods.length} 个节次`);
    } catch (error) {
      showSnackbar({ message: `文本解析失败：${error instanceof Error ? error.message : '未知错误'}`, duration: 6000 });
    }
  };

  const stat = schedule.periods.reduce(
    (total, period) => total + period.days.reduce((sum, day) => sum + day.length, 0),
    0,
  );

  return (
    <ExpandableSheet open={open} onClose={onClose} sourceRef={sourceRef} icon="edit_calendar" title="课表数据">
      <div ref={sourceRef} />
      <div className="col gap-12">
        <div className="md-body-medium muted">
          当前课表：{scheduleImported ? '已导入' : '内置（来自 学生课表.doc）'} · {schedule.owner || '未署名'} · {schedule.term} ·{' '}
          {schedule.periods.length} 节次 · {stat} 门课
        </div>

        <div className="button-group" style={{ justifyContent: 'flex-start' }}>
          <md-filled-tonal-button onClick={() => void importFile()} disabled={busy ? '' : undefined}>
            <MdIcon slot="icon" name="upload_file" />
            选择文件
          </md-filled-tonal-button>
          <md-outlined-button onClick={() => { setSchedule(null); onImported('已恢复内置课表'); }}>
            <MdIcon slot="icon" name="settings_backup_restore" />
            恢复内置
          </md-outlined-button>
        </div>
        <div className="md-body-small muted">
          支持 .doc/.rtf（教务系统导出）、.html（表格另存为）、.csv/.txt（复制的课表文本）。导入后保存在本机浏览器。
        </div>

        <MdTextField
          label="粘贴课表文本"
          value={pasted}
          onValueChange={setPasted}
          type="textarea"
          rows={4}
          supportingText="首行为「节次/星期 星期一 …」，随后每个节次一行，制表符分隔各天"
        />
        <div>
          <md-text-button onClick={importText}>解析并导入文本</md-text-button>
        </div>

        <div className="col gap-8">
          <div className="md-title-small-emphasized">学期开始日期（第 1 周周一）</div>
          <input
            type="date"
            value={termStart}
            onChange={(event) => setTermStart(event.target.value)}
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
          <div className="row gap-8">
            <md-filled-tonal-button
              className="btn-s"
              onClick={() => {
                updateSettings({ termStart }, { message: '已保存学期开始日期' });
              }}
            >
              保存日期
            </md-filled-tonal-button>
            <span className="md-body-small muted flex-1">用于计算当前教学周，进而过滤每周实际开设的课程。</span>
          </div>
        </div>
      </div>
    </ExpandableSheet>
  );
}
