import { CONDITION_IDS, type ConditionId } from './conditions';
import { compatibleResponse, studyMaterialIssues, validateApproval, validateManifest, type Approval, type ClipManifest } from './materials';
import { assert, finite, id, object, text } from './validation';
export type Question = { id: string; prompt: string; kind?: 'single' | 'number' | 'text'; options?: string[]; min?: number; max?: number; maxLength?: number; required: boolean };
export type Questionnaire = { id: string; version: string; timing: 'pre' | 'round' | 'post'; questions: Question[]; approval: Approval };
export type Round = { condition: ConditionId; groupId: string; clipId: string };
export type Plan = {
  schema: 'punchcap-plan-v1'; id: string; version: string; approval: Approval;
  allocation: { strategy: 'williams' | 'custom'; basis: string; approval: Approval };
  matching: { threshold: number | null; scores: Record<string, number>; basis: string; approval: Approval };
  assignments: { participantId: string; rounds: Round[] }[];
  clips: ClipManifest[]; practiceClipId: string; responses: Record<string, string[]>; questionnaires: Questionnaire[];
};
export function allocationIssues(assignments: Plan['assignments']): string[] {
  const issues: string[] = [];
  if (assignments.length % 4 !== 0) issues.push('Williams 平衡需完整四人批次');
  for (let column = 0; column < 4; column++) {
    const counts = CONDITION_IDS.map(c => assignments.filter(a => a.rounds[column]?.condition === c).length);
    if (new Set(counts).size !== 1) issues.push(`第 ${column + 1} 轮条件不平衡`);
  }
  const carry = new Map<string, number>();
  for (const a of assignments) for (let i = 1; i < a.rounds.length; i++) { const k = a.rounds[i - 1].condition + a.rounds[i].condition; carry.set(k, (carry.get(k) ?? 0) + 1); }
  const pairs = CONDITION_IDS.flatMap(a => CONDITION_IDS.filter(b => a !== b).map(b => carry.get(a + b) ?? 0));
  if (new Set(pairs).size !== 1) issues.push('相邻条件的前序影响不平衡');
  const groups = [...new Set(assignments.flatMap(a => a.rounds.map(r => r.groupId)))];
  for (let column = 0; column < 4; column++) { const counts = groups.map(g => assignments.filter(a => a.rounds[column]?.groupId === g).length); if (new Set(counts).size !== 1) issues.push(`第 ${column + 1} 轮段子组不平衡`); }
  for (const group of groups) {
    const counts = CONDITION_IDS.map(c => assignments.flatMap(a => a.rounds).filter(r => r.groupId === group && r.condition === c).length);
    if (new Set(counts).size !== 1) issues.push(`段子组 ${group} 与条件未平衡`);
  }
  return issues;
}
export function validatePlan(value: unknown): Plan {
  assert(object(value) && value.schema === 'punchcap-plan-v1' && id(value.id) && id(value.version) && Array.isArray(value.clips) && value.clips.length > 0 && value.clips.length <= 1000
    && Array.isArray(value.assignments) && value.assignments.length > 0 && value.assignments.length <= 10000 && id(value.practiceClipId) && object(value.responses) && Array.isArray(value.questionnaires), '研究配置格式或版本无效。');
  validateApproval(value.approval);
  const clips = value.clips.map(validateManifest), clipMap = new Map(clips.map(c => [c.id, c]));
  assert(clipMap.size === clips.length && clipMap.get(value.practiceClipId)?.kind === 'practice', '片段编号重复或缺少练习片段。');
  const people = new Set<string>();
  for (const assignment of value.assignments) {
    assert(object(assignment) && id(assignment.participantId) && !people.has(assignment.participantId) && Array.isArray(assignment.rounds) && assignment.rounds.length === 4, '参与者安排必须唯一并包含四轮。');
    people.add(assignment.participantId); const conditions = new Set<string>(), groups = new Set<string>();
    for (const round of assignment.rounds) {
      assert(object(round) && CONDITION_IDS.includes(round.condition as ConditionId) && id(round.groupId) && id(round.clipId) && clipMap.get(round.clipId)?.kind === 'main', '轮次条件、段子组或主片段无效。');
      conditions.add(String(round.condition)); groups.add(String(round.groupId));
    }
    assert(conditions.size === 4 && groups.size === 4, '每人需各经历 A–D 一次及四个不同段子组。');
  }
  for (const [mainId, responses] of Object.entries(value.responses)) {
    const main = clipMap.get(mainId);
    assert(main?.kind === 'main' && Array.isArray(responses) && responses.length <= 100 && new Set(responses).size === responses.length, '回应片段关联无效。');
    for (const responseId of responses) { const response = clipMap.get(responseId); assert(response && compatibleResponse(main, response), '回应必须使用同一演员、模型版本与映射比例。'); }
  }
  const questionnaires = new Set<string>(), timings = new Set<string>();
  for (const q of value.questionnaires) {
    assert(object(q) && id(q.id) && id(q.version) && !questionnaires.has(q.id) && ['pre', 'round', 'post'].includes(String(q.timing)) && !timings.has(String(q.timing)) && Array.isArray(q.questions) && q.questions.length > 0 && q.questions.length <= 300, '问卷版本、时点或题目无效。');
    questionnaires.add(q.id); timings.add(String(q.timing)); validateApproval(q.approval); const ids = new Set<string>();
    for (const question of q.questions) {
      assert(object(question) && id(question.id) && !ids.has(question.id) && text(question.prompt) && typeof question.required === 'boolean' && ['single', 'number', 'text'].includes(String(question.kind ?? 'single')), '问卷题号、类型或必答标记无效。');
      const kind = question.kind ?? 'single';
      if (kind === 'single') assert(Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 20 && question.options.every(o => text(o, 300)) && new Set(question.options).size === question.options.length, '选项题需有不同选项。');
      else if (kind === 'number') assert(finite(question.min) && finite(question.max) && question.min <= question.max, '数字题需明确上下界。');
      else assert(Number.isSafeInteger(question.maxLength) && finite(question.maxLength) && question.maxLength > 0 && question.maxLength <= 4000, '文本题需明确长度上限。');
      ids.add(question.id);
    }
  }
  assert(object(value.allocation) && ['williams', 'custom'].includes(String(value.allocation.strategy)) && typeof value.allocation.basis === 'string', '分配依据无效。'); validateApproval(value.allocation.approval);
  assert(object(value.matching) && typeof value.matching.basis === 'string' && object(value.matching.scores) && (value.matching.threshold === null || finite(value.matching.threshold) && value.matching.threshold >= 0)
    && Object.entries(value.matching.scores).every(([key, score]) => id(key) && finite(score)), '预评分依据或阈值无效。'); validateApproval(value.matching.approval);
  return { ...value, clips } as Plan;
}
export function studyPlanIssues(plan: Plan): string[] {
  const issues: string[] = [];
  if (plan.approval.status !== 'approved') issues.push('研究配置尚未确认');
  if (plan.allocation.approval.status !== 'approved' || !plan.allocation.basis) issues.push('分配依据尚未确认');
  if (plan.allocation.strategy === 'williams') issues.push(...allocationIssues(plan.assignments));
  if (plan.matching.approval.status !== 'approved' || plan.matching.threshold === null || !plan.matching.basis) issues.push('预评分匹配依据尚未确认');
  const groups = [...new Set(plan.assignments.flatMap(a => a.rounds.map(r => r.groupId)))], scores = groups.map(g => plan.matching.scores[g]);
  if (scores.some(s => !finite(s))) issues.push('段子组缺少预评分');
  else if (plan.matching.threshold !== null && Math.max(...scores) - Math.min(...scores) > plan.matching.threshold) issues.push('段子组预评分差异超出确认阈值');
  for (const timing of ['pre', 'round', 'post']) { const q = plan.questionnaires.find(q => q.timing === timing); if (!q || q.approval.status !== 'approved') issues.push(`${timing} 问卷尚未确认`); }
  for (const c of plan.clips) issues.push(...studyMaterialIssues(c).map(p => `${c.id}：${p}`));
  return issues;
}
export function validateAnswers(q: Questionnaire, input: unknown): Record<string, string | number> {
  assert(object(input) && Object.keys(input).every(key => q.questions.some(q => q.id === key)), '答案包含未知题号。');
  for (const question of q.questions) {
    const answer = input[question.id]; if (answer === undefined && !question.required) continue;
    if (question.kind === 'number') assert(finite(answer) && answer >= question.min! && answer <= question.max!, '数字答案越界。');
    else if (question.kind === 'text') assert(typeof answer === 'string' && answer.length <= question.maxLength! && (!question.required || answer.trim().length > 0), '文本答案缺失或过长。');
    else assert(Number.isInteger(answer) && finite(answer) && answer >= 0 && answer < question.options!.length, '必答题缺失或答案不在选项中。');
  }
  return input as Record<string, string | number>;
}
