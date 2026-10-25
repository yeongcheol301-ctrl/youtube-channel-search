// 출석과 일일 미션. 날짜는 'YYYY-MM-DD' 문자열로 받는다(테스트하기 쉽게).
const fail = (reason) => ({ ok: false, reason });

export const ATTEND_REWARDS = [5, 5, 10, 10, 15, 15, 40];
export const MISSIONS = {
  enhance: { label: '강화 20회', goal: 20, reward: 5 },
  boss: { label: '보스 도전 1회', goal: 1, reward: 5 },
  ad: { label: '광고 보기 1회', goal: 1, reward: 5 },
};
export const ALL_CLEAR_REWARD = 10;

export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevKey(key) {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10);
}

// 날이 바뀌면 미션 기록을 비운다. 출석 기록은 남긴다.
export function dailyOf(meta, today) {
  const d = meta.daily;
  if (!d || d.day !== today) meta.daily = { day: today, streak: d?.streak ?? 0, lastAttend: d?.lastAttend ?? null, counts: {}, claimed: [] };
  return meta.daily;
}

export const canAttend = (meta, today) => dailyOf(meta, today).lastAttend !== today;

// 오늘 출석하면 받을 날짜 칸(0~6).
export function attendSlot(meta, today) {
  const d = dailyOf(meta, today);
  if (d.lastAttend === today) return (d.streak - 1) % 7;
  return d.lastAttend === prevKey(today) ? d.streak % 7 : 0;
}

export function attend(meta, today) {
  const d = dailyOf(meta, today);
  if (d.lastAttend === today) return fail('오늘은 이미 출석했습니다');
  d.streak = d.lastAttend === prevKey(today) ? d.streak + 1 : 1;
  d.lastAttend = today;
  const reward = ATTEND_REWARDS[(d.streak - 1) % 7];
  meta.coins += reward;
  return { ok: true, reward, streak: d.streak };
}

export function track(meta, key, today, n = 1) {
  const d = dailyOf(meta, today);
  d.counts[key] = (d.counts[key] ?? 0) + n;
}

const done = (d, key) => (d.counts[key] ?? 0) >= MISSIONS[key].goal;

export function missionRows(meta, today) {
  const d = dailyOf(meta, today);
  const rows = Object.entries(MISSIONS).map(([key, m]) => ({
    key, label: m.label, reward: m.reward, goal: m.goal,
    count: Math.min(m.goal, d.counts[key] ?? 0), claimed: d.claimed.includes(key), ready: done(d, key) && !d.claimed.includes(key),
  }));
  const allDone = Object.keys(MISSIONS).every((k) => d.claimed.includes(k));
  rows.push({ key: 'all', label: '오늘 미션 모두 완료', reward: ALL_CLEAR_REWARD, goal: 1, count: allDone ? 1 : 0, claimed: d.claimed.includes('all'), ready: allDone && !d.claimed.includes('all') });
  return rows;
}

export function claimMission(meta, key, today) {
  const row = missionRows(meta, today).find((r) => r.key === key);
  if (!row) return fail('없는 미션');
  if (!row.ready) return fail(row.claimed ? '이미 받았습니다' : '아직 완료하지 않았습니다');
  dailyOf(meta, today).claimed.push(key);
  meta.coins += row.reward;
  return { ok: true, reward: row.reward };
}

export const dailyAlert = (meta, today) => canAttend(meta, today) || missionRows(meta, today).some((r) => r.ready);
