import type { Session } from '../core/session';
import type { AudioUpload } from '../core/measurement';
import { assert } from '../core/validation';
export function audioForSession(s: Session, audio: AudioUpload) {
  assert(s.execution && audio.sessionId === s.id && audio.participantId === s.participantId && audio.round <= s.roundIndex, '录音身份或轮次不符。');
  const round = s.plan.assignments.find(a => a.participantId === s.participantId)!.rounds[audio.round], practice = audio.clipId === s.plan.practiceClipId;
  assert(practice ? audio.round === 0 : audio.clipId === round.clipId, '录音主片段不符。');
  for (const marker of audio.markers) {
    const c = marker.context, clip = s.plan.clips.find(p => p.id === c.clipId);
    assert(clip && marker.mediaMs <= clip.durationMs && (practice ? c.phase === 'practice' && c.clipId === audio.clipId : c.phase === 'main' && c.clipId === round.clipId || c.phase === 'response' && round.condition === 'D' && c.response > 0 && (s.plan.responses[round.clipId] ?? []).includes(c.clipId)), '录音时间标记与主片段或回应不一致。');
  }
}
