/**
 * 主页 (Home)
 *
 * Top container  : live speech-to-text raw transcript   -> tap = fullscreen panel
 * Divider
 * Middle container: transcript + image summary + key points + mind map -> tap = fullscreen panel
 * Bottom         : "长按输入文本" field (drawn in front, long press = question mode)
 *                  + connected button group [拍照][导入图片]
 * Nav bar        : 首页 selected
 */
import { useCallback, useRef, useState } from 'react';
import { AppNavBar, SectionHeader, TopAppBar, useLongPress } from '../components/layout';
import { MdIcon, MdIconButton, MdTextField } from '../components/md';
import { ExpandableSheet } from '../components/overlays';
import { KeyPointList, MindMapView, QaBranchList, TranscriptView } from '../components/content';
import { useAppState } from '../state/AppState';
import { useNav } from '../nav/navigation';
import { useSpeechRecognition } from '../lib/speech';
import { analyzeImage, askQuestion, topicFor } from '../lib/api';
import { pickImageFile, prepareImageFile } from '../lib/imaging';
import { formatDateTime } from '../lib/utils';
import type { Draft } from '../lib/types';

export default function HomeScreen() {
  const nav = useNav();
  const {
    settings,
    draft,
    effectiveKeyPoints,
    appendTranscript,
    setDraft,
    addBranchAnswer,
    createRecord,
    removeRecord,
    resetDraft,
    markDraftSaved,
    showSnackbar,
  } = useAppState();

  const [topOpen, setTopOpen] = useState(false);
  const [middleOpen, setMiddleOpen] = useState(false);
  const [questionMode, setQuestionMode] = useState(false);
  const [question, setQuestion] = useState('');
  const [manualText, setManualText] = useState('');
  const [busy, setBusy] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);

  const speech = useSpeechRecognition({
    intensity: settings.speechIntensity,
    onFinal: appendTranscript,
    onError: (message) => showSnackbar({ message, duration: 6000 }),
  });

  const sheetOpen = topOpen || middleOpen;

  /* ------------------------------------------------------------- actions */

  const saveRecord = useCallback(async () => {
    const snapshot: Draft = { ...draft };
    const hasImage = draft.images.length > 0;
    const record = await createRecord({
      title: hasImage && !draft.transcript ? `图片记录 · ${formatDateTime(Date.now())}` : `语音记录 · ${formatDateTime(Date.now())}`,
      note: draft.imageSummary || draft.transcript.slice(0, 80),
      images: draft.images,
      transcript: draft.transcript,
      imageSummary: draft.imageSummary,
      keyPoints: draft.keyPoints.length ? draft.keyPoints : effectiveKeyPoints,
      branches: draft.branches,
      tags: draft.tags,
    });
    resetDraft();
    markDraftSaved();
    setTopOpen(false);
    setMiddleOpen(false);
    showSnackbar({
      message: '已保存到历史记录',
      actionLabel: '撤销',
      onAction: () => {
        void removeRecord(record.id);
        setDraft(snapshot);
        showSnackbar({ message: '已撤销保存，内容回到主页草稿' });
      },
    });
  }, [
    createRecord,
    draft,
    effectiveKeyPoints,
    markDraftSaved,
    removeRecord,
    resetDraft,
    setDraft,
    showSnackbar,
  ]);

  const importImage = useCallback(async () => {
    const file = await pickImageFile();
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await prepareImageFile(file, settings.cameraSharpness);
      setDraft({ images: [dataUrl, ...draft.images].slice(0, 8) });
      if (settings.visionApiUrl.trim()) {
        const result = await analyzeImage(dataUrl, settings);
        setDraft({
          imageSummary: result.summary,
          keyPoints: result.keyPoints,
          tags: Array.from(new Set([...draft.tags, ...result.tags])),
        });
        showSnackbar({ message: '图片已识别并生成总结' });
      } else {
        showSnackbar({
          message: '已导入图片。配置“图片转文字API”后可自动识别与总结。',
          duration: 6000,
        });
      }
    } catch (error) {
      showSnackbar({ message: `图片识别失败：${error instanceof Error ? error.message : '未知错误'}`, duration: 6000 });
    } finally {
      setBusy(false);
    }
  }, [draft.images, draft.tags, setDraft, settings, showSnackbar]);

  const submitQuestion = useCallback(async () => {
    const text = question.trim();
    if (!text) return;
    setQuestion('');
    setBusy(true);
    const context = {
      transcript: draft.transcript,
      imageSummary: draft.imageSummary,
      keyPoints: effectiveKeyPoints,
    };
    try {
      const result = await askQuestion(text, context, settings);
      const topic = result.topic || topicFor(text, context);
      addBranchAnswer(text, result.answer, topic, result.source);
      showSnackbar({
        message:
          result.source === 'none'
            ? '记录中没有相关内容，已新建一个分支'
            : result.source === 'api'
              ? '已从问答接口获得回答'
              : '已根据本次记录内容生成回答',
      });
    } finally {
      setBusy(false);
    }
  }, [addBranchAnswer, draft.imageSummary, draft.transcript, effectiveKeyPoints, question, settings, showSnackbar]);

  const submitManualText = useCallback(() => {
    const text = manualText.trim();
    if (!text) return;
    appendTranscript(text);
    setManualText('');
    showSnackbar({ message: '已追加到语音转文字内容' });
  }, [appendTranscript, manualText, showSnackbar]);

  const longPressField = useLongPress(
    () => {
      setQuestionMode(true);
      showSnackbar({ message: '已进入提问模式：输入问题后按回车发送', duration: 4000 });
    },
    () => {
      /* a short tap keeps the normal text input behaviour */
    },
  );

  const selectTab = (tab: 'home' | 'history' | 'schedule' | 'settings') => {
    if (tab === 'home') {
      nav.popTo('home');
      return;
    }
    nav.push(tab, {}, 'slide');
  };

  return (
    <>
      <div className={['screen-inner', sheetOpen ? 'stacked' : ''].join(' ').trim()}>
        <div className="screen-content">
        {/* ---------------------------------------------- live transcript */}
        <div
          className="container-box surface-high clickable"
          style={{ height: 216, display: 'flex', flexDirection: 'column', gap: 8 }}
          ref={topRef}
          onClick={() => setTopOpen(true)}
          role="button"
          tabIndex={0}
          aria-label="实时语音转文字，点击放大"
        >
          <div className="row gap-8">
            {speech.listening ? <span className="live-dot" /> : <MdIcon name="graphic_eq" size={20} />}
            <span className="md-title-small-emphasized flex-1">
              {speech.listening ? '正在聆听…' : '实时语音转文字'}
            </span>
            <MdIconButton
              icon={speech.listening ? 'stop_circle' : 'mic'}
              label={speech.listening ? '停止语音识别' : '开始语音识别'}
              tonal
              onClick={() => speech.toggle()}
            />
          </div>
          <div className="flex-1 scroll-y">
            <TranscriptView transcript={draft.transcript} interim={speech.interim} />
          </div>
          <div className="row gap-4 muted">
            <MdIcon name="open_in_full" size={16} />
            <span className="md-label-medium">点击容器全屏查看原文</span>
          </div>
        </div>

        <md-divider className="mt-12 mb-12" />

        {/* ------------------------------------ summary / key points / map */}
        <div
          className="container-box tertiary clickable"
          style={{ minHeight: 424, display: 'flex', flexDirection: 'column', gap: 12 }}
          ref={middleRef}
          onClick={() => setMiddleOpen(true)}
          role="button"
          tabIndex={0}
          aria-label="总结与思维导图，点击放大"
        >
          <div className="row gap-8">
            <MdIcon name="summarize" size={20} />
            <span className="md-title-small-emphasized flex-1">总结 · 重点 · 思维导图</span>
            <MdIcon name="open_in_full" size={18} />
          </div>

          <div>
            <div className="md-label-medium mb-8" style={{ opacity: 0.85 }}>
              语音转文字
            </div>
            <div className="md-body-medium" style={{ maxHeight: 72, overflow: 'hidden' }}>
              {draft.transcript ? draft.transcript : <span style={{ opacity: 0.8 }}>还没有语音内容。</span>}
            </div>
          </div>

          <div>
            <div className="md-label-medium mb-8" style={{ opacity: 0.85 }}>
              图片总结
            </div>
            <div className="md-body-medium" style={{ maxHeight: 56, overflow: 'hidden' }}>
              {draft.imageSummary || <span style={{ opacity: 0.8 }}>导入图片后由图片转文字API生成总结。</span>}
            </div>
          </div>

          {draft.images.length ? (
            <div className="row gap-8">
              {draft.images.slice(0, 3).map((src, index) => (
                <div
                  className="media-thumb"
                  key={`${index}-${src.slice(-12)}`}
                  style={{ width: 72, height: 72, flex: '0 0 auto', borderRadius: 16 }}
                >
                  <img src={src} alt={`草稿图片 ${index + 1}`} />
                </div>
              ))}
              {draft.images.length > 3 ? (
                <span className="md-label-large">+{draft.images.length - 3}</span>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1 scroll-y">
            <div className="md-label-medium mb-8" style={{ opacity: 0.85 }}>
              思维导图
            </div>
            <MindMapView
              topic={draft.transcript ? draft.transcript.slice(0, 14) : '本次记录'}
              keyPoints={effectiveKeyPoints.slice(0, 3)}
              branches={draft.branches}
            />
          </div>
        </div>

        <div className="flex-1" style={{ minHeight: 16 }} />

        {/* ------------------------------------------------- input + buttons */}
        <div className="col" style={{ position: 'relative' }}>
          <div
            {...longPressField}
            className="home-input"
            style={{ position: 'relative', zIndex: 2, marginBottom: -24, touchAction: 'manipulation' }}
          >
            <MdTextField
              label={questionMode ? '提问模式 · 回车发送' : '长按输入文本'}
              value={questionMode ? question : manualText}
              onValueChange={(value) => (questionMode ? setQuestion(value) : setManualText(value))}
              onEnter={() => (questionMode ? void submitQuestion() : submitManualText())}
              leadingIcon={<MdIcon name="voice_selection" />}
              trailingIcon={
                questionMode ? (
                  <div className="row" style={{ gap: 0 }}>
                    <MdIconButton icon="send" label="发送问题" onClick={() => void submitQuestion()} />
                    <MdIconButton icon="close" label="退出提问模式" onClick={() => setQuestionMode(false)} />
                  </div>
                ) : (
                  <MdIconButton icon="keyboard_return" label="追加到转写文字" onClick={submitManualText} />
                )
              }
            />
          </div>

          <div className="button-group" style={{ marginTop: 8 }}>
            <md-filled-button onClick={() => nav.push('camera', {}, 'zoom')}>
              <MdIcon slot="icon" name="photo_camera" />
              拍照
            </md-filled-button>
            <md-filled-button onClick={() => void importImage()} disabled={busy ? '' : undefined}>
              <MdIcon slot="icon" name="add_photo_alternate" />
              导入图片
            </md-filled-button>
          </div>
        </div>
      </div>

      <AppNavBar active="home" onSelect={selectTab} />
      </div>

      {/* ------------------------------------------------ fullscreen panels */}
      <ExpandableSheet
        open={topOpen}
        onClose={() => setTopOpen(false)}
        sourceRef={topRef}
        icon="graphic_eq"
        title="语音转文字原文"
        headerActions={
          <md-filled-tonal-button onClick={() => void saveRecord()}>保存为记录</md-filled-tonal-button>
        }
      >
        <div className="md-label-medium muted mb-12">
          {speech.listening ? '正在实时转写…' : '实时转写已暂停'} · {formatDateTime(draft.updatedAt || Date.now())}
        </div>
        <TranscriptView transcript={draft.transcript} interim={speech.interim} />
      </ExpandableSheet>

      <ExpandableSheet
        open={middleOpen}
        onClose={() => setMiddleOpen(false)}
        sourceRef={middleRef}
        icon="summarize"
        title="记录总结与重点"
        headerActions={
          <md-filled-tonal-button onClick={() => void saveRecord()}>保存为记录</md-filled-tonal-button>
        }
      >
        <SectionHeader icon="graphic_eq" title="语音转文字" />
        <TranscriptView transcript={draft.transcript} interim={speech.interim} />

        <div className="mt-16">
          <SectionHeader icon="image" title="图片总结" />
          <div className="md-body-medium" style={{ whiteSpace: 'pre-wrap' }}>
            {draft.imageSummary || '还没有图片总结。可在主页导入一张图片，或前往相机拍摄。'}
          </div>
        </div>

        <div className="mt-16">
          <SectionHeader icon="lightbulb" title="重点内容" />
          <KeyPointList points={effectiveKeyPoints} />
        </div>

        <div className="mt-16">
          <SectionHeader icon="account_tree" title="思维导图" />
          <MindMapView
            topic={draft.transcript ? draft.transcript.slice(0, 14) : '本次记录'}
            keyPoints={effectiveKeyPoints}
            branches={draft.branches}
          />
        </div>

        <div className="mt-16">
          <SectionHeader icon="forum" title="问答分支" />
          <QaBranchList branches={draft.branches} />
        </div>
      </ExpandableSheet>
    </>
  );
}
