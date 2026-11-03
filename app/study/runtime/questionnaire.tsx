'use client';
import { useEffect, useState } from 'react';
import { validateAnswers, type Questionnaire, type ScenePanel } from '@/study/web/runtime-api';
export function RunQuestionnaire({ questionnaire: q, disabled, submit, panel, exitVR }: { questionnaire: Questionnaire; disabled: boolean; submit: (answers: Record<string, string | number>) => void; panel: (value: ScenePanel | null) => void; exitVR: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({}), [index, setIndex] = useState(0), [page, setPage] = useState(0), [error, setError] = useState('');
  const question = q.questions[index];
  function send() { try { submit(validateAnswers(q, answers)); setError(''); } catch (e) { setError(String(e)); } }
  useEffect(() => {
    const question = q.questions[index], value = answers[question.id];
    const choices = question.kind === 'number'
      ? [{ id: 'minus', label: '减 1' }, { id: 'plus', label: '加 1' }]
      : question.kind === 'text' ? [{ id: 'text', label: '退出 VR 输入文字' }]
      : (question.options ?? []).slice(page * 4, page * 4 + 4).map((label, i) => ({ id: `option-${page * 4 + i}`, label }));
    panel({ title: `问卷 ${index + 1}/${q.questions.length} · ${q.version}`, lines: [question.prompt, `当前：${value === undefined ? '未作答' : question.kind === 'number' || question.kind === 'text' ? value : question.options?.[Number(value)]}`, error || '工程草稿，不能替代最终研究问卷。'], buttons: [...choices, ...(page > 0 ? [{ id: 'options-prev', label: '上一页选项' }] : []), ...((question.options?.length ?? 0) > (page + 1) * 4 ? [{ id: 'options-next', label: '下一页选项' }] : []), { id: 'previous', label: '上一题' }, { id: 'next', label: index === q.questions.length - 1 ? '提交问卷' : '下一题' }].slice(0, 8), choose: id => {
      if (disabled) return;
      if (id.startsWith('option-')) setAnswers(a => ({ ...a, [question.id]: Number(id.slice(7)) }));
      else if (id === 'plus' || id === 'minus') setAnswers(a => ({ ...a, [question.id]: Math.max(question.min!, Math.min(question.max!, Number(a[question.id] ?? question.min!) + (id === 'plus' ? 1 : -1))) }));
      else if (id === 'text') exitVR();
      else if (id === 'options-prev' || id === 'options-next') setPage(p => p + (id === 'options-next' ? 1 : -1));
      else if (id === 'previous') { setIndex(i => Math.max(0, i - 1)); setPage(0); }
      else if (id === 'next') { if (index === q.questions.length - 1) { try { submit(validateAnswers(q, answers)); setError(''); } catch (e) { setError(String(e)); } } else { setIndex(i => i + 1); setPage(0); } }
    } });
    return () => panel(null);
  }, [q, answers, index, page, disabled, submit, panel, exitVR, error]);
  return <section className="work-card run-questionnaire"><h2>{q.timing === 'pre' ? '开始前确认' : q.timing === 'post' ? '结束后反馈' : '本轮评分与问卷'}</h2><p>问卷 {q.id} / {q.version} · 当前使用工程草稿。</p><form onSubmit={e => { e.preventDefault(); send(); }}>
    {q.questions.map(question => <fieldset key={question.id} disabled={disabled}><legend>{question.prompt}{question.required ? '（必答）' : '（可选）'}</legend>{question.kind === 'number' ? <label>评分<input aria-label={question.prompt} type="number" step="any" min={question.min} max={question.max} required={question.required} value={answers[question.id] ?? ''} onChange={e => setAnswers(a => { const next = { ...a }; if (e.target.value === '') delete next[question.id]; else next[question.id] = Number(e.target.value); return next; })}/></label> : question.kind === 'text' ? <textarea aria-label={question.prompt} maxLength={question.maxLength} required={question.required} value={answers[question.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [question.id]: e.target.value }))}/> : question.options?.map((label, i) => <label className="run-option" key={label}><input type="radio" name={question.id} required={question.required} checked={answers[question.id] === i} onChange={() => setAnswers(a => ({ ...a, [question.id]: i }))}/>{label}</label>)}</fieldset>)}
    <p role="alert">{error}</p><button disabled={disabled} type="submit">提交本阶段问卷</button></form><p>VR 内可用射线选择；长文本可退出 VR 在页面输入，进度保留。当前题：{question.prompt}</p></section>;
}
