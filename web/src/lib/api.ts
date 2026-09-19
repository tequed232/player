/**
 * Speech-to-text / image-to-text / question answering integrations.
 *
 * The endpoints and keys are configured by the user on the API screen and stored locally.
 * Nothing here invents content: when an endpoint is not configured the caller either falls
 * back to a *local* analysis of the data the user actually produced (keyword overlap over
 * the real transcript / summary) or reports a clear error so the UI can tell the user.
 */
import type { AppSettings } from './types';
import { keywords, splitSentences } from './utils';

export interface TextSummary {
  summary: string;
  keyPoints: string[];
  tags: string[];
}

export type AnswerSource = 'api' | 'local' | 'none';

export interface AnswerResult {
  answer: string;
  source: AnswerSource;
  topic: string;
}

function authHeaders(key: string): Record<string, string> {
  if (!key.trim()) return {};
  return { Authorization: `Bearer ${key.trim()}`, 'x-api-key': key.trim() };
}

/** Pull the first useful text out of an unknown JSON payload. */
function pickText(payload: unknown, depth = 0): string {
  if (payload == null || depth > 4) return '';
  if (typeof payload === 'string') return payload.trim();
  if (typeof payload === 'number') return String(payload);
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = pickText(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const preferred = [
      'text',
      'transcript',
      'summary',
      'description',
      'caption',
      'answer',
      'result',
      'output',
      'content',
      'message',
      'data',
      'choices',
    ];
    for (const key of preferred) {
      if (key in record) {
        const found = pickText(record[key], depth + 1);
        if (found) return found;
      }
    }
    for (const value of Object.values(record)) {
      const found = pickText(value, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function parseJsonish(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function readResponse(response: Response): Promise<string> {
  const raw = await response.text();
  return pickText(parseJsonish(raw));
}

/** POST a JSON body and return extracted text; throws with a readable message. */
async function postJson(url: string, body: unknown, key: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(key) },
    body: JSON.stringify(body),
  });
  const text = await readResponse(response);
  if (!response.ok) {
    throw new Error(`接口返回 ${response.status}${text ? `：${text.slice(0, 120)}` : ''}`);
  }
  if (!text) throw new Error('接口没有返回可用的文本');
  return text;
}

/** Speech-to-text for a recorded audio blob (multipart, OpenAI compatible). */
export async function transcribeAudio(blob: Blob, settings: AppSettings): Promise<string> {
  const url = settings.sttApiUrl.trim();
  if (!url) throw new Error('未配置语音转文字API');
  const form = new FormData();
  form.append('file', blob, 'audio.webm');
  form.append('model', 'whisper-1');
  const response = await fetch(url, { method: 'POST', headers: authHeaders(settings.sttApiKey), body: form });
  const text = await readResponse(response);
  if (!response.ok) throw new Error(`语音转文字接口返回 ${response.status}${text ? `：${text.slice(0, 120)}` : ''}`);
  if (!text) throw new Error('语音转文字接口没有返回文本');
  return text;
}

/** Image-to-text: sends the picked/captured image and returns summary + key points. */
export async function analyzeImage(dataUrl: string, settings: AppSettings): Promise<TextSummary> {
  const url = settings.visionApiUrl.trim();
  if (!url) throw new Error('未配置图片转文字API');
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  const text = await postJson(
    url,
    {
      image: base64,
      image_url: dataUrl,
      task: 'describe-and-summarize',
      prompt: '请描述这张图片，并给出要点列表（每行以 - 开头），最后一行以 # 开头给出最多三个标签。',
    },
    settings.visionApiKey,
  );
  return structureSummary(text);
}

/** Split a free-form model answer into summary / key points / tags. */
export function structureSummary(text: string): TextSummary {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keyPoints: string[] = [];
  const tags: string[] = [];
  const prose: string[] = [];
  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) keyPoints.push(line.replace(/^[-*•]\s+/, ''));
    else if (/^#/.test(line)) tags.push(...line.replace(/^#+\s*/, '').split(/[,，、\s]+/).filter(Boolean));
    else if (/^(要点|key points?)[:：]/i.test(line)) keyPoints.push(line.split(/[:：]/).slice(1).join(':').trim());
    else prose.push(line);
  }
  const summary = prose.join('\n').trim();
  return {
    summary: summary || text.trim(),
    keyPoints: keyPoints.length ? keyPoints : deriveKeyPoints(summary || text),
    tags: tags.slice(0, 4),
  };
}

/** Ask a question about the current record content. */
export async function askQuestion(
  question: string,
  context: { transcript: string; imageSummary: string; keyPoints: string[] },
  settings: AppSettings,
): Promise<AnswerResult> {
  const url = settings.qaApiUrl.trim();
  if (url) {
    try {
      const answer = await postJson(
        url,
        {
          question,
          context: {
            transcript: context.transcript,
            image_summary: context.imageSummary,
            key_points: context.keyPoints,
          },
          prompt: '只依据给定的记录内容回答问题，不要编造。',
        },
        settings.qaApiKey,
      );
      return { answer, source: 'api', topic: topicFor(question, context) };
    } catch (error) {
      const message = error instanceof Error ? error.message : '问答接口调用失败';
      return { answer: `问答接口调用失败：${message}`, source: 'api', topic: topicFor(question, context) };
    }
  }
  const local = localAnswer(question, context);
  return local;
}

/** Which mind-map branch the question belongs to. */
export function topicFor(
  question: string,
  context: { transcript: string; imageSummary: string; keyPoints: string[] },
): string {
  const words = keywords(question);
  if (!words.length) return question.length > 12 ? `${question.slice(0, 12)}…` : question;
  const haystack = `${context.transcript}\n${context.imageSummary}\n${context.keyPoints.join('\n')}`.toLowerCase();
  let best = words[0];
  let bestScore = -1;
  for (const word of words) {
    const score = haystack.split(word).length - 1;
    if (score > bestScore) {
      bestScore = score;
      best = word;
    }
  }
  return best;
}

/**
 * Local answer: finds the parts of the *actual* captured data that match the question.
 * No match -> the branch is created but explicitly reports that nothing was found.
 */
export function localAnswer(
  question: string,
  context: { transcript: string; imageSummary: string; keyPoints: string[] },
): AnswerResult {
  const words = keywords(question);
  const topic = topicFor(question, context);
  interface Hit {
    text: string;
    where: string;
    score: number;
  }
  const hits: Hit[] = [];
  const add = (text: string, where: string) => {
    const lower = text.toLowerCase();
    let score = 0;
    for (const word of words) if (lower.includes(word)) score += 1;
    if (score > 0) hits.push({ text: text.trim(), where, score });
  };
  splitSentences(context.transcript).forEach((sentence) => add(sentence, '语音转文字'));
  splitSentences(context.imageSummary).forEach((sentence) => add(sentence, '图片总结'));
  context.keyPoints.forEach((point) => add(point, '重点'));

  if (!hits.length) {
    return {
      answer: '当前记录里没有找到与该问题相关的内容。可以先在主页录制语音或导入图片，再针对内容提问。',
      source: 'none',
      topic,
    };
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 3);
  const body = top.map((hit) => `· 来自${hit.where}：${hit.text}`).join('\n');
  return { answer: `在本次记录中找到以下相关内容：\n${body}`, source: 'local', topic };
}

/** Deterministic key point extraction used when the vision API returns plain prose. */
export function deriveKeyPoints(text: string, limit = 5): string[] {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];
  const frequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of new Set(keywords(sentence))) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }
  const scored = sentences.map((sentence, index) => {
    const words = new Set(keywords(sentence));
    let score = 0;
    words.forEach((word) => {
      score += frequency.get(word) ?? 0;
    });
    return { sentence, score: score / Math.max(1, words.size) + (index === 0 ? 0.8 : 0) };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => (item.sentence.length > 60 ? `${item.sentence.slice(0, 59)}…` : item.sentence));
}
