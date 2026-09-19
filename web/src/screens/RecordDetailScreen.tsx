/**
 * 屏幕 5 - record detail
 *
 * Entered by tapping a history card. Top app bar (back / delete), a multi-browse
 * carousel of the record images that expands into a full screen viewer, and a
 * surfaceContainerHigh container with the transcript + image summary that expands
 * into a scrollable full screen panel.
 */
import { useEffect, useRef, useState } from 'react';
import { EmptyState, SectionHeader, TopAppBar } from '../components/layout';
import { MdDialog, MdIcon, MdIconButton, MdTextField } from '../components/md';
import { ConfirmDialog, ExpandableSheet, ImageViewer } from '../components/overlays';
import { KeyPointList, MultiBrowseCarousel, QaBranchList, TranscriptView } from '../components/content';
import { useAppState } from '../state/AppState';
import { useNav, useRouteParams } from '../nav/navigation';
import { truncate } from '../lib/utils';

export default function RecordDetailScreen() {
  const nav = useNav();
  const params = useRouteParams();
  const { records, removeRecord, updateRecord, restoreRecords, showSnackbar } = useAppState();
  const record = records.find((item) => item.id === params.id);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(record?.title ?? '');
  const [note, setNote] = useState(record?.note ?? '');
  const panelSource = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (record) {
      setTitle(record.title);
      setNote(record.note);
    }
  }, [record]);

  if (!record) {
    return (
      <>
        <div className="screen-inner">
          <TopAppBar title="记录详情" onBack={() => nav.pop()} />
          <div className="screen-content">
            <div className="flex-1 col" style={{ justifyContent: 'center' }}>
              <EmptyState
                icon="search_off"
                title="记录不存在"
                description="这条记录可能已经被删除。"
                action={<md-filled-button onClick={() => nav.pop()}>返回</md-filled-button>}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  const deleteRecord = async () => {
    setConfirmDelete(false);
    const snapshot = record;
    await removeRecord(record.id);
    showSnackbar({
      message: '已删除该记录',
      actionLabel: '撤销',
      onAction: () => {
        void restoreRecords([snapshot]);
        showSnackbar({ message: '已恢复记录' });
      },
    });
    if (nav.stack.length > 1) nav.pop();
  };

  return (
    <>
      <div className={['screen-inner', sheetOpen ? 'stacked' : ''].join(' ').trim()}>
        <TopAppBar
          title={record.title}
          onBack={() => nav.pop()}
          backLabel="返回上一页"
          actions={
            <>
              <MdIconButton icon="edit" label="编辑标题与说明" onClick={() => setEditing(true)} />
              <MdIconButton icon="delete" label="删除这条记录" onClick={() => setConfirmDelete(true)} />
            </>
          }
        />

        <div className="screen-content" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div style={{ padding: '0 16px' }}>
            <SectionHeader
              icon="photo_library"
              title={`图片（${record.images.length}）`}
              trailing={
                record.images.length ? (
                  <span className="md-label-medium muted">点击图片全屏查看</span>
                ) : null
              }
            />
          </div>

          {record.images.length ? (
            <MultiBrowseCarousel
              images={record.images}
              labels={record.images.map((_, index) => (index === 0 ? '主图' : `图片 ${index + 1}`))}
              onSelect={(index) => setViewerIndex(index)}
            />
          ) : (
            <div style={{ padding: '0 16px' }}>
              <div className="image-placeholder" style={{ height: 180 }}>
                <MdIcon name="image" size={48} />
              </div>
              <div className="md-body-small hint mt-8">这条记录没有图片，可以返回主页拍摄或导入。</div>
            </div>
          )}

          <div style={{ padding: '12px 16px 0' }}>
            <div
              className="container-box surface-high clickable"
              style={{ minHeight: 320, display: 'flex', flexDirection: 'column', gap: 12 }}
              ref={panelSource}
              onClick={() => setSheetOpen(true)}
              role="button"
              tabIndex={0}
              aria-label="记录文字要点，点击全屏展开"
            >
              <div className="row gap-8">
                <MdIcon name="article" size={20} />
                <span className="md-title-small-emphasized flex-1">语音转文字与图片总结</span>
                <MdIcon name="open_in_full" size={18} />
              </div>

              <div>
                <div className="md-label-medium mb-8 muted">语音转文字</div>
                <div className="md-body-medium" style={{ maxHeight: 96, overflow: 'hidden' }}>
                  {record.transcript ? truncate(record.transcript, 180) : '这条记录没有语音转文字内容。'}
                </div>
              </div>

              <div>
                <div className="md-label-medium mb-8 muted">图片总结</div>
                <div className="md-body-medium" style={{ maxHeight: 96, overflow: 'hidden' }}>
                  {record.imageSummary ? truncate(record.imageSummary, 180) : '这条记录没有图片总结。'}
                </div>
              </div>

              {record.keyPoints.length ? (
                <div>
                  <div className="md-label-medium mb-8 muted">重点内容</div>
                  <KeyPointList points={record.keyPoints.slice(0, 3)} />
                </div>
              ) : null}

              {record.branches.length ? (
                <div className="md-label-medium muted">包含 {record.branches.length} 个问答分支，点击查看</div>
              ) : null}
            </div>
          </div>

          {record.tags.length ? (
            <div className="chip-row" style={{ padding: '12px 16px 0' }}>
              {record.tags.map((tag) => (
                <span className="chip solid" key={tag}>
                  <MdIcon name="label" size={16} />
                  <span className="md-label-large">{tag}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ExpandableSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sourceRef={panelSource}
        icon="article"
        title={record.title}
      >
        <SectionHeader icon="graphic_eq" title="语音转文字" />
        <TranscriptView transcript={record.transcript} placeholder="这条记录没有语音转文字内容。" />

        <div className="mt-16">
          <SectionHeader icon="image" title="图片总结" />
          <div className="md-body-medium" style={{ whiteSpace: 'pre-wrap' }}>
            {record.imageSummary || '这条记录没有图片总结。'}
          </div>
        </div>

        <div className="mt-16">
          <SectionHeader icon="lightbulb" title="重点内容" />
          <KeyPointList points={record.keyPoints} />
        </div>

        <div className="mt-16">
          <SectionHeader icon="forum" title="问答分支" />
          <QaBranchList branches={record.branches} />
        </div>
      </ExpandableSheet>

      {viewerIndex !== null && record.images.length ? (
        <ImageViewer
          images={record.images}
          startIndex={viewerIndex}
          title={record.title}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        headline="删除这条记录？"
        body={`“${record.title}”将被永久删除，删除后可通过底部的提示条撤销。`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteRecord()}
      />

      <MdDialog
        open={editing}
        headline="编辑记录"
        onClosed={() => setEditing(false)}
        actions={
          <>
            <md-text-button onClick={() => setEditing(false)}>取消</md-text-button>
            <md-text-button
              onClick={() => {
                const previous = { title: record.title, note: record.note };
                const next = { title: title.trim() || previous.title, note };
                void updateRecord(record.id, next);
                setEditing(false);
                showSnackbar({
                  message: '已保存修改',
                  actionLabel: '撤销',
                  onAction: () => void updateRecord(record.id, previous),
                });
              }}
            >
              保存
            </md-text-button>
          </>
        }
      >
        <MdTextField label="标题" value={title} onValueChange={setTitle} />
        <div className="mt-12">
          <MdTextField label="辅助说明文字" value={note} onValueChange={setNote} />
        </div>
      </MdDialog>
    </>
  );
}
