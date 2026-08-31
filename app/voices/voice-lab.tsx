'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AVATARS, DEFAULT_AVATAR_ID, getAvatar, type AvatarId } from '../data/avatars';
import {
  MOSI_VOICE_GUIDE,
  MOSI_VOICE_GUIDE_BY_ID,
  type MosiVoiceGuide,
} from '../data/mosi-voices';

type AvailableVoice = MosiVoiceGuide & {
  available: boolean;
};

type VoiceBindings = Partial<Record<AvatarId, string>>;

type VoiceListResponse = {
  voices?: Array<{ id: string; name: string }>;
  error?: string;
};

type SpeechResponse = {
  url?: string;
  error?: string;
};

const VOICE_BINDINGS_KEY = 'vr-standup:voice-bindings';

function readStoredBindings(): VoiceBindings {
  try {
    const value = window.localStorage.getItem(VOICE_BINDINGS_KEY);
    return value ? (JSON.parse(value) as VoiceBindings) : {};
  } catch {
    return {};
  }
}

export function VoiceLab() {
  const [selectedAvatarId, setSelectedAvatarId] =
    useState<AvatarId>(DEFAULT_AVATAR_ID);
  const [bindings, setBindings] = useState<VoiceBindings>({});
  const [voices, setVoices] = useState<AvailableVoice[]>(
    MOSI_VOICE_GUIDE.map((voice) => ({ ...voice, available: true })),
  );
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'live' | 'guide'>(
    'loading',
  );
  const [previewText, setPreviewText] = useState(
    '欢迎来到今晚的 VR 脱口秀。[pause 0.8s]准备好了吗？',
  );
  const [audioUrl, setAudioUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedVoiceId, setCopiedVoiceId] = useState('');

  const selectedAvatar = getAvatar(selectedAvatarId);
  const selectedVoiceId = bindings[selectedAvatarId] ?? '';
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId),
    [selectedVoiceId, voices],
  );

  useEffect(() => {
    fetch('/api/tts/voices?limit=100')
      .then(async (response) => {
        const payload = (await response.json()) as VoiceListResponse;
        if (!response.ok || !payload.voices) throw new Error(payload.error);
        return payload.voices;
      })
      .then((availableVoices) => {
        const liveIds = new Set(availableVoices.map((voice) => voice.id));
        const enrichedLiveVoices = availableVoices.map((voice) => {
          const guide = MOSI_VOICE_GUIDE_BY_ID.get(voice.id);
          return {
            id: voice.id,
            name: voice.name || guide?.name || '未命名音色',
            description: guide?.description || '当前账户可用音色',
            language: guide?.language || '语言以 Mosi 音色库为准',
            useCase: guide?.useCase || '自定义或账户音色',
            available: true,
          };
        });
        const guideOnlyVoices = MOSI_VOICE_GUIDE.filter(
          (voice) => !liveIds.has(voice.id),
        ).map((voice) => ({ ...voice, available: false }));

        setVoices([...enrichedLiveVoices, ...guideOnlyVoices]);
        setBindings(readStoredBindings());
        setCatalogStatus('live');
      })
      .catch(() => {
        setBindings(readStoredBindings());
        setCatalogStatus('guide');
      });
  }, []);

  const bindVoice = (voiceId: string) => {
    const nextBindings = { ...bindings, [selectedAvatarId]: voiceId };
    setBindings(nextBindings);
    window.localStorage.setItem(VOICE_BINDINGS_KEY, JSON.stringify(nextBindings));
    setAudioUrl('');
    setPreviewError('');
  };

  const generatePreview = async () => {
    if (!selectedVoiceId) return;
    setIsGenerating(true);
    setAudioUrl('');
    setPreviewError('');

    try {
      const response = await fetch('/api/tts/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: previewText,
          voiceId: selectedVoiceId,
          model: 'moss-tts-1.5-flash',
        }),
      });
      const payload = (await response.json()) as SpeechResponse;
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || '语音生成失败。');
      }
      setAudioUrl(payload.url);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : '语音生成失败，请稍后重试。',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const copyVoiceId = async (voiceId: string) => {
    await navigator.clipboard.writeText(voiceId);
    setCopiedVoiceId(voiceId);
    window.setTimeout(() => setCopiedVoiceId(''), 1600);
  };

  return (
    <main className="voice-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="返回 VR Standup 首页">
          <span className="brand-mark" aria-hidden="true">
            VS
          </span>
          <span>VR Standup</span>
        </Link>
        <Link className="topbar-link" href="/">
          返回剧场
        </Link>
      </header>

      <section className="voice-hero">
        <p className="eyebrow">MOSI TTS · VOICE CASTING GUIDE</p>
        <h1>
          给每位演员，
          <span>选一种声音。</span>
        </h1>
        <p>
          这里使用 Mosi 的 Voice ID 绑定演员。密钥只保存在服务器上；浏览器只提交台词和选中的 Voice ID，因此不会看到 API Key。
        </p>
      </section>

      <section className="voice-steps" aria-labelledby="voice-steps-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 id="voice-steps-title">四步完成声线配置</h2>
          </div>
          <span className={`catalog-state catalog-state-${catalogStatus}`}>
            {catalogStatus === 'loading' && '正在读取账户音色'}
            {catalogStatus === 'live' && '已连接 Mosi 音色库'}
            {catalogStatus === 'guide' && '正在显示文档示例音色'}
          </span>
        </div>
        <ol className="instruction-grid">
          <li>
            <span>01</span>
            <strong>选择演员</strong>
            <p>先确定要配置哪位 Avatar；每位演员都会单独保存一个 Voice ID。</p>
          </li>
          <li>
            <span>02</span>
            <strong>试听与比较</strong>
            <p>根据语言、气质和表演节奏筛选音色，不要只按性别判断。</p>
          </li>
          <li>
            <span>03</span>
            <strong>绑定 Voice ID</strong>
            <p>Mosi TTS 只接受 Voice ID；选择音色卡后，绑定会保存在当前设备。</p>
          </li>
          <li>
            <span>04</span>
            <strong>生成试听</strong>
            <p>输入短台词并生成 MP3；可用 [pause 1.0s] 控制明显停顿。</p>
          </li>
        </ol>
      </section>

      <section className="voice-workbench" aria-labelledby="workbench-title">
        <div className="workbench-sidebar">
          <p className="eyebrow">STEP 01 · ACTOR</p>
          <h2 id="workbench-title">选择演员</h2>
          <div className="actor-chip-list">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                className={avatar.id === selectedAvatarId ? 'is-selected' : ''}
                onClick={() => setSelectedAvatarId(avatar.id)}
                aria-pressed={avatar.id === selectedAvatarId}
              >
                <span style={{ background: avatar.accent }}>{avatar.shortLabel}</span>
                <span>
                  <strong>{avatar.name}</strong>
                  <small>{bindings[avatar.id] ? '已绑定声线' : '尚未绑定'}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="selected-actor-summary">
            <span>当前演员</span>
            <strong>{selectedAvatar.name}</strong>
            <p>{selectedAvatar.voiceDirection}</p>
            <small>
              {selectedVoice ? `已选：${selectedVoice.name}` : '请从右侧选择一个音色'}
            </small>
          </div>
        </div>

        <div className="voice-catalog">
          <div className="voice-catalog-heading">
            <div>
              <p className="eyebrow">STEP 02 · VOICE ID</p>
              <h2>选择声线</h2>
            </div>
            <a
              href="https://mossland.studio/"
              target="_blank"
              rel="noreferrer"
            >
              打开完整音色库 ↗
            </a>
          </div>
          <div className="voice-card-grid">
            {voices.map((voice) => {
              const selected = voice.id === selectedVoiceId;
              return (
                <article
                  key={voice.id}
                  className={`voice-card${selected ? ' is-selected' : ''}${
                    voice.available ? '' : ' is-guide-only'
                  }`}
                >
                  <button
                    className="voice-card-main"
                    type="button"
                    onClick={() => bindVoice(voice.id)}
                    aria-pressed={selected}
                  >
                    <span className="voice-card-state">
                      {selected ? '已绑定' : voice.available ? '可用' : '示例'}
                    </span>
                    <strong>{voice.name}</strong>
                    <p>{voice.description}</p>
                    <small>{voice.language}</small>
                    <small>{voice.useCase}</small>
                  </button>
                  <button
                    className="copy-voice-id"
                    type="button"
                    onClick={() => copyVoiceId(voice.id)}
                    aria-label={`复制 ${voice.name} 的 Voice ID`}
                  >
                    {copiedVoiceId === voice.id ? '已复制' : '复制 ID'}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="preview-console" aria-labelledby="preview-title">
        <div>
          <p className="eyebrow">STEP 03 · TTS PREVIEW</p>
          <h2 id="preview-title">生成一段试听</h2>
          <p>
            使用 <code>moss-tts-1.5-flash</code>，输出 MP3 URL。每次最多 500 个字符；当前入口限制每分钟 6 次请求。
          </p>
        </div>
        <div className="preview-form">
          <label htmlFor="preview-text">试听台词</label>
          <textarea
            id="preview-text"
            value={previewText}
            maxLength={500}
            onChange={(event) => setPreviewText(event.target.value)}
            rows={4}
          />
          <div className="preview-form-footer">
            <span>{previewText.length} / 500</span>
            <button
              className="primary-action"
              type="button"
              onClick={generatePreview}
              disabled={!selectedVoiceId || !previewText.trim() || isGenerating}
            >
              {isGenerating ? '正在生成…' : '生成试听'}
              <span aria-hidden="true">▶</span>
            </button>
          </div>
          {previewError && <p className="preview-error" role="alert">{previewError}</p>}
          {audioUrl && (
            <div className="audio-result">
              <strong>{selectedAvatar.name} · {selectedVoice?.name}</strong>
              <audio controls autoPlay src={audioUrl}>
                您的浏览器不支持音频播放。
              </audio>
            </div>
          )}
        </div>
      </section>

      <section className="api-notes" aria-labelledby="api-notes-title">
        <p className="eyebrow">OFFICIAL MOSI RULES</p>
        <h2 id="api-notes-title">使用时记住这三点</h2>
        <div>
          <p><strong>只使用 Voice ID。</strong> TTS 不接受音色 URL、Base64 或参考音频。</p>
          <p><strong>停顿写进文本。</strong> 使用标准格式 <code>[pause 1.5s]</code>，支持 0.1–10.0 秒。</p>
          <p><strong>密钥永不进浏览器。</strong> 本站通过服务端读取环境变量并代理 Mosi 请求。</p>
        </div>
        <a
          href="https://platform.mosi.cn/docs/guides/quickstart/"
          target="_blank"
          rel="noreferrer"
        >
          阅读 Mosi 官方快速开始 ↗
        </a>
      </section>
    </main>
  );
}
