/**
 * PokerSkill Integration Test Suite (JavaScript)
 * Tests: 5-layer architecture, A/B toggle, BotManager lifecycle, action parsing
 */

const { PokerSkillBot } = require('../app/core/PokerSkillBot');
const { BotManager } = require('../app/core/BotManager');
const fs = require('fs');
const path = require('path');

// ============================================
// Test Framework
// ============================================
const result = { passed: 0, failed: 0, warnings: 0, logs: [] };

function assert(condition, testName, detail) {
  if (condition) {
    result.passed++;
    result.logs.push(`[PASS] ${testName}${detail ? ': ' + detail : ''}`);
  } else {
    result.failed++;
    result.logs.push(`[FAIL] ${testName}${detail ? ': ' + detail : ' assertion failed'}`);
  }
}

function warn(testName, detail) {
  result.warnings++;
  result.logs.push(`[WARN] ${testName}: ${detail}`);
}

function section(title) {
  result.logs.push(`\n${'='.repeat(60)}`);
  result.logs.push(title);
  result.logs.push('='.repeat(60));
}

// ============================================
// Mock Game States
// ============================================
function createMockState(overrides = {}) {
  return {
    handCard: ['m4', 'm3'],
    commonCard: [],
    pot: 30,
    prevSize: 10,
    smallBlind: 5,
    bigBlind: 10,
    myPosition: 'd',
    myCounter: 1000,
    myActionSize: 0,
    isShort: false,
    players: [
      { nickName: 'Alice', counter: 950, actionSize: 10, actionCommand: 'call', type: '', status: 1, vpip: 0.3, pfr: 0.15 },
      { nickName: 'Bob', counter: 980, actionSize: 0, actionCommand: '', type: '', status: 1 },
    ],
    currentRoundActions: [{ nickName: 'Alice', action: 'call', stage: 'preflop' }],
    stage: 'preflop',
    numActivePlayers: 3,
    ...overrides,
  };
}

// ============================================
// Group 1: PokerSkillBot Core - 5-Layer
// ============================================
section('GROUP 1: PokerSkillBot Core - 5-Layer Architecture');

// 1.1 P1 always present
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState());
  assert(prompt.includes('游戏规则'), 'P1 Game rules present');
  assert(prompt.includes('fold'), 'P1 fold documented');
  assert(prompt.includes('check'), 'P1 check documented');
  assert(prompt.includes('call'), 'P1 call documented');
  assert(prompt.includes('raise'), 'P1 raise documented');
  assert(prompt.includes('allin'), 'P1 allin documented');
  assert(prompt.includes('action_type'), 'P1 output format specified');
}

// 1.2 P2 present for preflop
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'preflop' }));
  assert(prompt.includes('翻前范围指导 (P2)'), 'P2 Preflop guidance present');
  assert(prompt.includes('premium_pair'), 'P2 AA classified as premium_pair');
  assert(prompt.includes('庄位(Button)'), 'P2 Position detection correct');
}

// 1.3 P3 present for flop
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'flop', commonCard: ['i3', 'h2', 'd4'], handCard: ['k3', 'j3'] }));
  assert(!prompt.includes('翻前范围指导 (P2)'), 'P2 NOT present for flop');
  assert(prompt.includes('翻后通用原则与牌力评估 (P3)'), 'P3 Postflop guidance present');
  assert(prompt.includes('牌力'), 'P3 Hand strength present');
}

// 1.4 P4 present for postflop
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'turn', commonCard: ['m1', 'm2', 'k3', 'e4'], handCard: ['m3', 'l3'] }));
  assert(prompt.includes('针对性策略 (P4)'), 'P4 Targeted strategy present for turn');
}

// 1.5 P5 present for river
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'], handCard: ['j4', 'h4'] }));
  assert(prompt.includes('河牌诈唬与抓诈指导 (P5)'), 'P5 River guidance present');
  assert(prompt.includes('诈唬条件检查'), 'P5 Bluff conditions present');
  assert(prompt.includes('抓诈条件检查'), 'P5 Bluff-catch conditions present');
}

// 1.6 P5 NOT for non-river
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'flop', commonCard: ['i3', 'h2', 'd4'] }));
  assert(!prompt.includes('河牌诈唬与抓诈指导 (P5)'), 'P5 NOT present for flop');
}

// 1.7 P4 NOT for preflop
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'preflop' }));
  assert(!prompt.includes('针对性策略 (P4)'), 'P4 NOT present for preflop');
}

// ============================================
// Group 2: A/B Toggle
// ============================================
section('GROUP 2: A/B Toggle - Baseline vs PokerSkill');

// 2.1 Baseline: only P1
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: false });
  const prompt = bot.buildPrompt(createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'] }));
  assert(prompt.includes('游戏规则'), 'Baseline P1 present');
  assert(!prompt.includes('P2'), 'Baseline P2 absent');
  assert(!prompt.includes('P3'), 'Baseline P3 absent');
  assert(!prompt.includes('P4'), 'Baseline P4 absent');
  assert(!prompt.includes('P5'), 'Baseline P5 absent');
}

// 2.2 PokerSkill: all layers for river
{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const prompt = bot.buildPrompt(createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'] }));
  assert(prompt.includes('P3'), 'Skill P3 present');
  assert(prompt.includes('P4'), 'Skill P4 present');
  assert(prompt.includes('P5'), 'Skill P5 present');
}

// 2.3 Info delta
{
  const baseBot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: false });
  const skillBot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  const state = createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'] });
  const baseLen = baseBot.buildPrompt(state).length;
  const skillLen = skillBot.buildPrompt(state).length;
  const ratio = skillLen / baseLen;
  assert(ratio > 1.3, 'Info delta > 1.3x', `ratio = ${ratio.toFixed(2)}x (${baseLen} -> ${skillLen})`);
}

// ============================================
// Group 3: BotManager Lifecycle
// ============================================
section('GROUP 3: BotManager - Bot Lifecycle & A/B Toggle');

// 3.1 Creation
{
  const bm = new BotManager({ enableBots: true, botCount: 2, enablePokerSkill: true, llmApiUrl: 'http://t', llmApiKey: 'k', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5 });
  assert(bm !== null, 'BotManager created');
  assert(bm.isPokerSkillEnabled() === true, 'PokerSkill enabled by default');
}

// 3.2 Bot creation
{
  const bm = new BotManager({ enableBots: true, botCount: 2, enablePokerSkill: true, llmApiUrl: 'http://t', llmApiKey: 'k', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5 });
  const bots = bm.createBots(2, 1000);
  assert(bots.length === 2, 'Correct bot count', `created ${bots.length}`);
  assert(bots[0].isBot === true, 'isBot flag set');
  assert(bots[0].nickName.includes('AI'), 'Chinese bot name', bots[0].nickName);
  assert(bots[0].counter === 1000, 'Starting chips correct');
}

// 3.3 A/B toggle at runtime
{
  const bm = new BotManager({ enableBots: true, botCount: 1, enablePokerSkill: true, llmApiUrl: 'http://t', llmApiKey: 'k', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5 });
  bm.initPokerSkill();
  assert(bm.isPokerSkillEnabled() === true, 'Initially enabled');
  bm.setPokerSkillEnabled(false);
  assert(bm.isPokerSkillEnabled() === false, 'Disabled after toggle');
  bm.setPokerSkillEnabled(true);
  assert(bm.isPokerSkillEnabled() === true, 'Re-enabled');
}

// 3.4 Bot identification
{
  const bm = new BotManager({ enableBots: true, botCount: 1, enablePokerSkill: true, llmApiUrl: 'http://t', llmApiKey: 'k', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5 });
  const bots = bm.createBots(1, 1000);
  assert(bm.isBot(bots[0].userId) === true, 'Bot identified');
  assert(bm.isBot('human_user') === false, 'Human not identified as bot');
}

// 3.5 Config exposure
{
  const bm = new BotManager({ enableBots: true, botCount: 3, enablePokerSkill: false, llmApiUrl: 'http://c', llmApiKey: 'k', llmModel: 'gpt-4o', botChips: 2000, isShort: false, smallBlind: 5 });
  const cfg = bm.getConfig();
  assert(cfg.enableBots === true, 'Config enableBots');
  assert(cfg.botCount === 3, 'Config botCount');
  assert(cfg.enablePokerSkill === false, 'Config enablePokerSkill');
  assert(cfg.model === 'gpt-4o', 'Config model');
}

// ============================================
// Group 4: Hand Tier Classification
// ============================================
section('GROUP 4: Hand Tier Classification Matrix');

const tierTests = [
  { cards: ['m4', 'm3'], expected: 'premium_pair', name: 'AA' },
  { cards: ['l4', 'l3'], expected: 'premium_pair', name: 'KK' },
  { cards: ['k4', 'k3'], expected: 'premium_pair', name: 'QQ' },
  { cards: ['j4', 'j3'], expected: 'medium_pair', name: 'JJ' },
  { cards: ['i4', 'i3'], expected: 'medium_pair', name: 'TT' },
  { cards: ['h4', 'h3'], expected: 'low_pair', name: '99' },
  { cards: ['m3', 'l4'], expected: 'premium_broadway', name: 'AKs' },
  { cards: ['m1', 'l2'], expected: 'premium_broadway', name: 'AKo' },
  { cards: ['k3', 'j3'], expected: 'suited_connector', name: 'QJs' },
  { cards: ['m1', 'b2'], expected: 'marginal_high', name: 'A7o' },
  { cards: ['a1', 'b2'], expected: 'weak', name: '27o' },
];

{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  for (const t of tierTests) {
    const prompt = bot.buildPrompt(createMockState({ handCard: t.cards, stage: 'preflop' }));
    assert(prompt.includes(t.expected), `${t.name} -> ${t.expected}`, prompt.includes(t.expected) ? 'correct' : 'mismatch');
  }
}

// ============================================
// Group 5: Position Detection
// ============================================
section('GROUP 5: Position Detection');

{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  assert(bot.buildPrompt(createMockState({ myPosition: 'd' })).includes('庄位(Button)'), 'Dealer label');
  assert(bot.buildPrompt(createMockState({ myPosition: 'sb' })).includes('小盲(SB)'), 'SB label');
  assert(bot.buildPrompt(createMockState({ myPosition: 'bb' })).includes('大盲(BB)'), 'BB label');
}

// ============================================
// Group 6: BB Special Case
// ============================================
section('GROUP 6: Edge Cases');

{
  const bot = new PokerSkillBot({ apiUrl: 'http://test', apiKey: 'key', model: 'gpt-4o', enableSkills: true });
  
  // BB free check
  const bbPrompt = bot.buildPrompt(createMockState({ myPosition: 'bb', prevSize: 0, currentRoundActions: [] }));
  assert(bbPrompt.includes('大盲位特权'), 'BB special case');

  // Empty config still generates prompt
  const emptyBot = new PokerSkillBot({ apiUrl: '', apiKey: '', model: '', enableSkills: true });
  const emptyPrompt = emptyBot.buildPrompt(createMockState());
  assert(emptyPrompt.length > 0 && emptyPrompt.includes('游戏规则'), 'Empty config still works');

  // API methods exist
  assert(typeof bot.getAction === 'function', 'getAction method exists');
  assert(typeof bot.getHistory === 'function', 'getHistory method exists');
  assert(typeof bot.clearHistory === 'function', 'clearHistory method exists');
}

// ============================================
// Group 7: Frontend Integration
// ============================================
section('GROUP 7: Frontend Integration Points');

const clientDir = path.join(__dirname, '../../../../../client/src');

// 7.1 home.vue
{
  const homePath = path.join(clientDir, 'views/home.vue');
  if (fs.existsSync(homePath)) {
    const c = fs.readFileSync(homePath, 'utf-8');
    assert(c.includes('enableBots'), 'home.vue enableBots');
    assert(c.includes('botCount'), 'home.vue botCount');
    assert(c.includes('enablePokerSkill'), 'home.vue enablePokerSkill');
    assert(c.includes('llmApiUrl'), 'home.vue llmApiUrl');
    assert(c.includes('llmApiKey'), 'home.vue llmApiKey');
    assert(c.includes('llmModel'), 'home.vue llmModel');
    assert(c.includes('botChips'), 'home.vue botChips');
  } else { warn('home.vue', 'not found'); }
}

// 7.2 AIAdvisor.vue
{
  const p = path.join(clientDir, 'components/AIAdvisor.vue');
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf-8');
    assert(c.includes('isExpanded') || c.includes('drawer'), 'AIAdvisor drawer');
    assert(c.includes('analyze'), 'AIAdvisor API call');
  } else { warn('AIAdvisor.vue', 'not found'); }
}

// 7.3 game.vue
{
  const p = path.join(clientDir, 'views/game.vue');
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf-8');
    assert(c.includes('socket'), 'game.vue WebSocket');
    assert(c.includes('action'), 'game.vue actions');
  } else { warn('game.vue', 'not found'); }
}

// 7.4 Action.vue
{
  const p = path.join(clientDir, 'components/Action.vue');
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf-8');
    assert(c.includes('fold') && c.includes('check') && c.includes('raise'), 'Action.vue all actions');
    assert(c.includes('actioned'), 'Action.vue anti-double-click');
  } else { warn('Action.vue', 'not found'); }
}

// ============================================
// Group 8: Backend API Integration
// ============================================
section('GROUP 8: Backend API Integration Points');

const serverDir = path.join(__dirname, '../..');

// 8.1 ai.ts controller
{
  const p = path.join(serverDir, 'app/controller/ai.ts');
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf-8');
    assert(c.includes("@Controller('/node/ai')"), 'ai.ts route');
    assert(c.includes("INJECTION_PATTERNS"), 'ai.ts prompt injection protection');
    assert(c.includes("sanitizeAgentPrompt"), 'ai.ts input sanitization');
    assert(c.includes("stripSystemMessages"), 'ai.ts system msg stripping');
    assert(c.includes("/analyze"), 'ai.ts analyze endpoint');
    assert(c.includes("/config"), 'ai.ts config endpoints');
    assert(c.includes("/compress"), 'ai.ts compress endpoint');
  } else { warn('ai.ts', 'not found'); }
}

// 8.2 game.ts io controller - Bot integration
{
  const p = path.join(serverDir, 'app/io/controller/game.ts');
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf-8');
    assert(c.includes('BotManager'), 'game.ts imports BotManager');
    assert(c.includes('PokerSkill'), 'game.ts PokerSkill');
    assert(c.includes('enableBots'), 'game.ts enableBots');
    assert(c.includes('enablePokerSkill'), 'game.ts enablePokerSkill');
    assert(c.includes('triggerBotActionIfNeeded'), 'game.ts bot trigger');
    assert(c.includes('botManager'), 'game.ts botManager usage');
    assert(c.includes('maxChain'), 'game.ts anti-infinite-loop');
    assert(c.includes('initPokerSkill'), 'game.ts initPokerSkill');
  } else { warn('game.ts io', 'not found'); }
}

// 8.3 BotManager.ts
{
  const p = path.join(serverDir, 'app/core/BotManager.ts');
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf-8');
    assert(c.includes('setPokerSkillEnabled'), 'BotManager toggle');
    assert(c.includes('isPokerSkillEnabled'), 'BotManager check');
    assert(c.includes('initPokerSkill'), 'BotManager init');
    assert(c.includes('buildGameState'), 'BotManager state builder');
    assert(c.includes('simpleBotAction'), 'BotManager fallback');
    assert(c.includes('mapActionToCommand'), 'BotManager action mapper');
  } else { warn('BotManager.ts', 'not found'); }
}

// ============================================
// Summary
// ============================================
section('FINAL SUMMARY');

result.logs.push(`\nTOTAL: ${result.passed} passed, ${result.failed} failed, ${result.warnings} warnings`);
const total = result.passed + result.failed;
result.logs.push(`SUCCESS RATE: ${total > 0 ? ((result.passed / total) * 100).toFixed(1) : 0}%`);

if (result.failed === 0) {
  result.logs.push('\nAll PokerSkill integration tests PASSED!');
} else {
  result.logs.push(`\n${result.failed} test(s) FAILED`);
}

console.log(result.logs.join('\n'));
process.exit(result.failed > 0 ? 1 : 0);
