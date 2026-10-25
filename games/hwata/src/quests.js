// 물속 퀘스트: 바다에서 만난 사람. 거짓말이 있는 사람은 단서를 짚어야 사실을 털어놓는다.
import { giveItem, count } from './rules.js';
import { MATERIALS } from './data.js';

export const QUESTS = [
  {
    id: 'haenyeo', npc: 'haenyeo', name: '해녀 할망', day: 1, x: 27,
    intro: '숨이 차서 오늘은 미역을 한 줄기도 못 땄구먼. 젊은 의원 양반, 미역 한 줄기만 따다 주겠나?',
    need: 'seaweed', giveLabel: '미역을 건넨다',
    lack: '미역은 이 근처 얕은 바닥에 너울너울 자란다네.',
    done: '고맙네. 답례로 하나 알려 주지. 갑오징어 뼈를 곱게 갈면 속쓰림에 그만이라네. 갑오징어는 산호 비탈에 사는데, 먹물을 뿜고 달아나니 조심하게. (해표초 가루 개발 가능, 그물 3개)',
    reward(s) {
      s.flags.quest1 = true;
      s.arrows += 3;
    },
  },
  {
    id: 'boy', npc: 'boy', name: '울상인 소년', day: 3, x: 58,
    intro: '그냥 다리에 쥐가 났을 뿐이에요! 진짜예요!',
    clue: { label: '발바닥에 박힌 검은 가시를 가리킨다', truth: '사실... 할머니 몰래 성게를 따다가 밟았어요. 할머니한텐 비밀이에요.' },
    wrong: { label: '다리를 주물러 준다', reply: '아야! 쥐 난 거라니까요...' },
    need: 'oyster', giveLabel: '굴 껍데기로 가시를 빼 준다',
    notYet: '주물러 줘도 소년은 계속 발을 감싼다. 뭔가 숨기는 눈치다.',
    lack: '가시를 뺄 날카로운 굴 껍데기가 있으면 좋겠다. 굴은 바위 옆면에 붙어 있다.',
    done: '하나도 안 아파요! 할머니가 그러는데, 깊은 바다 모래밭에 해삼이 많대요. 엄마가 한의원에 꼭 들른대요! (평판 +5)',
    reward(s) {
      s.rep += 5;
      s.flags.cucumberHint = true;
    },
  },
  {
    id: 'zhangfei', npc: 'zhangfei', name: '물에 빠진 큰 사내', day: 6, x: 40,
    intro: '배에서 미끄러졌을 뿐이오! 술은 한 방울도 안 마셨소! 으으, 속이야...',
    clue: { label: '옆에 둥둥 떠다니는 빈 술병을 가리킨다', truth: '크흠... 들켰구려. 형님들 몰래 배 위에서 한 독을 다 비웠소. 속이 뒤집힐 것 같소.' },
    wrong: { label: '젖은 옷을 짜 준다', reply: '고맙소만, 이건 그냥 바닷물이오! 술 냄새 같은 건 안 나잖소!' },
    need: null, giveLabel: '오늘 밤 한의원으로 오라고 한다',
    notYet: '사내는 고개를 젓는다. "의원 따위 필요 없소!" 뭔가 숨기는 것 같다.',
    done: '알겠소, 오늘 밤 찾아가리다. 나는 연나라 사람 장비, 자는 익덕이오! (밤에 북어탕을 준비하세요)',
    reward(s) {
      s.flags.zhangfeiVisit = true;
    },
  },
];

const byId = (id) => QUESTS.find((q) => q.id === id);

export function activeQuests(s) {
  s.quests ??= {};
  return QUESTS.filter((q) => s.day >= q.day && !['done', 'invited'].includes(s.quests[q.id]));
}

export function questChoices(s, id) {
  const q = byId(id);
  const st = s.quests?.[id];
  const out = [];
  if (q.clue && st !== 'truth') {
    out.push({ action: 'clue', label: q.clue.label });
    out.push({ action: 'wrong', label: q.wrong.label });
  }
  const label = q.need ? `${q.giveLabel} (${MATERIALS[q.need].name} ${count(s, q.need)}개 있음)` : q.giveLabel;
  out.push({ action: 'give', label });
  return out;
}

export function questAct(s, id, action) {
  s.quests ??= {};
  const q = byId(id);
  if (action === 'clue') {
    s.quests[id] = 'truth';
    return { ok: true, text: q.clue.truth };
  }
  if (action === 'wrong') return { ok: false, text: q.wrong.reply };
  if (q.clue && s.quests[id] !== 'truth') return { ok: false, text: q.notYet };
  if (q.need && !giveItem(s, q.need)) return { ok: false, text: q.lack };
  s.quests[id] = q.need ? 'done' : 'invited';
  q.reward(s);
  return { ok: true, done: true, text: q.done };
}

