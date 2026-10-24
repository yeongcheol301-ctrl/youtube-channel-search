// 낮 퀘스트: 길에서 만난 다친 사람. 거짓말이 있는 사람은 단서를 짚어야 사실을 털어놓는다.
import { addItem, giveItem, count } from './rules.js';
import { MATERIALS } from './data.js';

export const QUESTS = [
  {
    id: 'woodcutter', npc: 'woodcutter', name: '나무꾼', day: 1, x: 30,
    intro: '넘어져서 팔을 긁혔을 뿐이오. 아이고, 따가워라.',
    need: 'plantain', giveLabel: '질경이를 찧어 붙여 준다',
    lack: '질경이가 있으면 좋을 텐데... 밭둑길에 많이 자라오.',
    done: '시원하구려! 고맙소. 우리 집안에 내려오는 고약 만드는 법을 알려 드리리다. (질경이 고약 개발 가능, 나무 5개)',
    reward(s) {
      s.flags.quest1 = true;
      for (let i = 0; i < 5; i++) addItem(s, 'wood');
    },
  },
  {
    id: 'child', npc: 'child', name: '우는 아이', day: 3, x: 82,
    intro: '배가 아파요... 아무것도 안 먹었어요. 정말이에요.',
    clue: { label: '입가에 묻은 붉은 물을 가리킨다', truth: '사실... 둔덕에서 덜 익은 살구를 몰래 따 먹었어요. 엄마한텐 비밀이에요.' },
    wrong: { label: '배를 살살 눌러 본다', reply: '아야! 그래도 아무것도 안 먹었다니까요...' },
    need: 'mugwort', giveLabel: '쑥을 씹어 먹인다',
    notYet: '먹이긴 했는데... 아이가 뭔가 숨기는 눈치다. 원인을 알아야 제대로 고칠 수 있겠다.',
    lack: '쑥이 있으면 좋겠다. 꽃 들판에 자란다.',
    done: '배가 안 아파요! 엄마가 한의원에 꼭 들른대요. 그리고 할아버지가 그러는데, 언덕 땅속 깊이 칡이 있대요. (평판 +5)',
    reward(s) {
      s.rep += 5;
      s.flags.kudzuHint = true;
    },
  },
  {
    id: 'zhangfei', npc: 'zhangfei', name: '쓰러진 큰 사내', day: 6, x: 117,
    intro: '멧돼지에게 받혔을 뿐이오! 술은 한 방울도 안 마셨소! 으으, 머리야...',
    clue: { label: '옆에 뒹구는 빈 술병을 가리킨다', truth: '크흠... 들켰구려. 형님들 몰래 한 독을 다 비웠소. 속이 뒤집힐 것 같소.' },
    wrong: { label: '이마의 상처를 살핀다', reply: '멧돼지 뿔에 긁힌 자국이오! 보시오, 술 냄새 같은 건 안 나잖소!' },
    need: null, giveLabel: '오늘 밤 한의원으로 오라고 한다',
    notYet: '사내는 고개를 젓는다. "의원 따위 필요 없소!" 뭔가 숨기는 것 같다.',
    done: '알겠소, 오늘 밤 찾아가리다. 나는 연나라 사람 장비, 자는 익덕이오! (밤에 칡즙을 준비하세요)',
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
