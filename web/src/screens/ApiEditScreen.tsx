/**
 * API修改 (API edit)
 *
 * "API编辑" top app bar (back / refresh / delete-all), the three outlined API fields
 * from the sketch (+ an optional QA endpoint), and the 380x380 test image placeholder
 * that actually runs a recognition against the configured image-to-text API.
 */
import { useState } from 'react';
import { SectionHeader, TopAppBar } from '../components/layout';
import { MdIcon, MdIconButton, MdTextField } from '../components/md';
import { ConfirmDialog } from '../components/overlays';
import { useAppState } from '../state/AppState';
import { useNav } from '../nav/navigation';
import { analyzeImage } from '../lib/api';
import { dataUrlSizeKb, pickImageFile, prepareImageFile } from '../lib/imaging';
import { isProbablyUrl } from '../lib/utils';

export default function ApiEditScreen() {
  const nav = useNav();
  const { settings, updateSettings, showSnackbar } = useAppState();

  const [sttUrl, setSttUrl] = useState(settings.sttApiUrl);
  const [sttKey, setSttKey] = useState(settings.sttApiKey);
  const [visionUrl, setVisionUrl] = useState(settings.visionApiUrl);
  const [visionKey, setVisionKey] = useState(settings.visionApiKey);
  const [qaUrl, setQaUrl] = useState(settings.qaApiUrl);
  const [showKeys, setShowKeys] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testImage, setTestImage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = () => {
    setSttUrl(settings.sttApiUrl);
    setSttKey(settings.sttApiKey);
    setVisionUrl(settings.visionApiUrl);
    setVisionKey(settings.visionApiKey);
    setQaUrl(settings.qaApiUrl);
    setErrors({});
    showSnackbar({ message: '已重新载入已保存的配置' });
  };

  const save = () => {
    const nextErrors: Record<string, string> = {};
    if (!isProbablyUrl(sttUrl)) nextErrors.sttUrl = '请输入以 http(s):// 开头的完整地址';
    if (!isProbablyUrl(visionUrl)) nextErrors.visionUrl = '请输入以 http(s):// 开头的完整地址';
    if (!isProbablyUrl(qaUrl)) nextErrors.qaUrl = '请输入以 http(s):// 开头的完整地址';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showSnackbar({ message: '接口地址格式不正确，请检查标红的输入框', duration: 5000 });
      return;
    }
    updateSettings(
      {
        sttApiUrl: sttUrl.trim(),
        sttApiKey: sttKey.trim(),
        visionApiUrl: visionUrl.trim(),
        visionApiKey: visionKey.trim(),
        qaApiUrl: qaUrl.trim(),
      },
      { message: '已保存API配置' },
    );
  };

  const pickTestImage = async () => {
    const file = await pickImageFile();
    if (!file) return;
    try {
      const dataUrl = await prepareImageFile(file, settings.cameraSharpness);
      setTestImage(dataUrl);
      setTestResult('');
      showSnackbar({ message: `已选择测试图片（${dataUrlSizeKb(dataUrl)} KB）` });
    } catch (error) {
      showSnackbar({ message: `读取图片失败：${error instanceof Error ? error.message : '未知错误'}` });
    }
  };

  const runTest = async () => {
    if (!testImage) {
      showSnackbar({ message: '请先选择一张测试图片', duration: 4000 });
      return;
    }
    if (!visionUrl.trim()) {
      showSnackbar({ message: '请先填写图片转文字API地址', duration: 4000 });
      return;
    }
    setTesting(true);
    setTestResult('');
    try {
      const result = await analyzeImage(testImage, {
        ...settings,
        visionApiUrl: visionUrl.trim(),
        visionApiKey: visionKey.trim(),
      });
      setTestResult([result.summary, ...result.keyPoints.map((point) => `- ${point}`)].join('\n'));
      showSnackbar({ message: '接口调用成功，已返回识别结果' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setTestResult(`调用失败：${message}`);
      showSnackbar({ message: `调用失败：${message}`, duration: 6000 });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div className="screen-inner">
        <TopAppBar
          title="API编辑"
          onBack={() => nav.pop()}
          backLabel="返回设置"
          actions={
            <>
              <MdIconButton icon="refresh" label="重新载入已保存的配置" onClick={reload} />
              <MdIconButton icon="delete" label="删除全部API配置" onClick={() => setConfirmDelete(true)} />
            </>
          }
        />

        <div className="screen-content">
          <MdTextField
            label="语音转文字API"
            value={sttUrl}
            onValueChange={setSttUrl}
            placeholder="https://example.com/v1/audio/transcriptions"
            supportingText={errors.sttUrl ?? 'POST multipart/form-data，字段名 file，返回 JSON 文本'}
            error={Boolean(errors.sttUrl)}
            leadingIcon={<MdIcon name="search" />}
            type="url"
          />

          <div className="mt-12">
            <MdTextField
              label="语音转文字API密钥"
              value={sttKey}
              onValueChange={setSttKey}
              placeholder="可留空"
              supportingText="以 Authorization: Bearer 方式发送，保存在本机"
              leadingIcon={<MdIcon name="key" />}
              type={showKeys ? 'text' : 'password'}
            />
          </div>

          <div className="mt-12">
            <MdTextField
              label="图片转文字API"
              value={visionUrl}
              onValueChange={setVisionUrl}
              placeholder="https://example.com/v1/vision/describe"
              supportingText={errors.visionUrl ?? 'POST JSON { image, task }，返回描述与要点'}
              error={Boolean(errors.visionUrl)}
              leadingIcon={<MdIcon name="search" />}
              type="url"
            />
          </div>

          <div className="mt-12">
            <MdTextField
              label="图片转文字API密钥"
              value={visionKey}
              onValueChange={setVisionKey}
              placeholder="可留空"
              supportingText="以 Authorization: Bearer 方式发送"
              leadingIcon={<MdIcon name="key" />}
              type={showKeys ? 'text' : 'password'}
            />
          </div>

          <div className="mt-12">
            <MdTextField
              label="问答API（可选）"
              value={qaUrl}
              onValueChange={setQaUrl}
              placeholder="https://example.com/v1/qa"
              supportingText={errors.qaUrl ?? '未配置时，提问会基于本机记录内容进行检索式回答'}
              error={Boolean(errors.qaUrl)}
              leadingIcon={<MdIcon name="search" />}
              type="url"
            />
          </div>

          <div className="row gap-8 mt-12">
            <md-text-button onClick={() => setShowKeys((value) => !value)}>
              {showKeys ? '隐藏密钥' : '显示密钥'}
            </md-text-button>
          </div>

          <div className="mt-16">
            <SectionHeader
              icon="image"
              title="测试图片"
              trailing={
                testImage ? (
                  <md-text-button onClick={() => { setTestImage(null); setTestResult(''); }}>
                    清除
                  </md-text-button>
                ) : null
              }
            />
            <div className="image-placeholder" style={{ height: 380, borderRadius: 20, overflow: 'hidden' }}>
              {testImage ? (
                <img
                  src={testImage}
                  alt="测试图片预览"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--md-sys-color-surface)' }}
                />
              ) : (
                <div className="col" style={{ alignItems: 'center', gap: 8 }}>
                  <MdIcon name="image" size={48} />
                  <span className="md-body-small">选择一张图片用于测试图片转文字API</span>
                </div>
              )}
            </div>

            <div className="button-group mt-12">
              <md-filled-tonal-button onClick={() => void pickTestImage()}>
                <MdIcon slot="icon" name="add_photo_alternate" />
                选择图片
              </md-filled-tonal-button>
              <md-filled-button onClick={() => void runTest()} disabled={testing ? '' : undefined}>
                <MdIcon slot="icon" name="bolt" />
                {testing ? '识别中…' : '测试识别'}
              </md-filled-button>
            </div>

            {testResult ? (
              <div className="container-box surface-high mt-12" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <div className="md-label-medium muted mb-8">接口返回</div>
                <div className="md-body-medium" style={{ whiteSpace: 'pre-wrap' }}>
                  {testResult}
                </div>
              </div>
            ) : null}
          </div>

          <div className="row gap-12 mt-16 mb-16">
            <md-outlined-button className="flex-1" onClick={() => nav.pop()}>
              取消
            </md-outlined-button>
            <md-filled-button className="flex-1" onClick={save}>
              保存配置
            </md-filled-button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        headline="删除全部API配置？"
        body="语音转文字、图片转文字与问答接口的地址和密钥都会被清空，可用底部提示条撤销。"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          setSttUrl('');
          setSttKey('');
          setVisionUrl('');
          setVisionKey('');
          setQaUrl('');
          updateSettings(
            { sttApiUrl: '', sttApiKey: '', visionApiUrl: '', visionApiKey: '', qaApiUrl: '' },
            { message: '已删除全部API配置' },
          );
          nav.pop();
        }}
      />
    </>
  );
}
