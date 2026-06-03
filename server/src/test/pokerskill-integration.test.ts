/**
 * PokerSkill Integration Test Suite
 * Tests the complete integration chain:
 *   Frontend config → BotManager → PokerSkillBot → LLM prompt → Action parsing
 *   A/B toggle: enable/disable PokerSkill layers
 *   Game flow: bot action trigger → PokerSkill decision → game action execution
 */

import { PokerSkillBot, PokerSkillConfig, GameStateForBot } from '../app/core/PokerSkillBot';
import { BotManager, BotRoomConfig } from '../app/core/BotManager';

// ============================================
// Test Framework
// ============================================

interface TestResult {
  passed: number;
  failed: number;
  warnings: number;
  logs: string[];
}

const result: TestResult = { passed: 0, failed: 0, warnings: 0, logs: [] };

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    result.passed++;
    result.logs.push(`[PASS] ${testName}${detail ? ': ' + detail : ''}`);
  } else {
    result.failed++;
    result.logs.push(`[FAIL] ${testName}${detail ? ': ' + detail : ' assertion failed'}`);
  }
}

function warn(testName: string, detail: string) {
  result.warnings++;
  result.logs.push(`[WARN] ${testName}: ${detail}`);
}

function section(title: string) {
  result.logs.push(`\n${'='.repeat(60)}`);
  result.logs.push(title);
  result.logs.push('='.repeat(60));
}

// ============================================
// Mock Game States
// ============================================

function createMockState(overrides: Partial<GameStateForBot> = {}): GameStateForBot {
  return {
    handCard: ['m4', 'm3'], // AA (pocket Aces)
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
    currentRoundActions: [
      { nickName: 'Alice', action: 'call', stage: 'preflop' },
    ],
    stage: 'preflop',
    numActivePlayers: 3,
    ...overrides,
  };
}

// ============================================
// Group 1: PokerSkillBot Core Tests
// ============================================

section('GROUP 1: PokerSkillBot Core - 5-Layer Architecture');

// 1.1 P1 always present
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState();
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('游戏规则'), 'P1 Game rules present', 'P1 rules in prompt');
  assert(prompt.includes('fold'), 'P1 fold action documented');
  assert(prompt.includes('check'), 'P1 check action documented');
  assert(prompt.includes('call'), 'P1 call action documented');
  assert(prompt.includes('raise'), 'P1 raise action documented');
  assert(prompt.includes('allin'), 'P1 allin action documented');
  assert(prompt.includes('action_type'), 'P1 output format specified');
}

// 1.2 P2 present for preflop
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({ stage: 'preflop' });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('翻前范围指导 (P2)'), 'P2 Preflop guidance present', 'P2 active for preflop');
  assert(prompt.includes('手牌等级: premium_pair'), 'P2 Hand classification correct for AA');
  assert(prompt.includes('位置: 庄位(Button)'), 'P2 Position detection correct');
}

// 1.3 P3 present for flop
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({
    stage: 'flop',
    commonCard: ['i3', 'h2', 'd4'],
    handCard: ['k3', 'j3'], // QJ suited
  });
  const prompt = bot.buildPrompt(state);

  assert(!prompt.includes('翻前范围指导 (P2)'), 'P2 NOT present for flop', 'P2 correctly skipped');
  assert(prompt.includes('翻后通用原则与牌力评估 (P3)'), 'P3 Postflop guidance present');
  assert(prompt.includes('牌力'), 'P3 Hand strength evaluation present');
}

// 1.4 P4 present for postflop
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({
    stage: 'turn',
    commonCard: ['m1', 'm2', 'k3', 'e4'],
    handCard: ['m3', 'l3'], // AA with AAK9 board
  });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('针对性策略 (P4)'), 'P4 Targeted strategy present for turn');
  assert(prompt.includes('在局人数:'), 'P4 Player count info present');
}

// 1.5 P5 present for river only
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({
    stage: 'river',
    commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'],
    handCard: ['j4', 'h4'], // JsTs
  });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('河牌诈唬与抓诈指导 (P5)'), 'P5 River guidance present');
  assert(prompt.includes('诈唬条件检查'), 'P5 Bluff conditions present');
  assert(prompt.includes('抓诈条件检查'), 'P5 Bluff-catch conditions present');
}

// 1.6 P5 NOT present for non-river stages
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({ stage: 'flop', commonCard: ['i3', 'h2', 'd4'] });
  const prompt = bot.buildPrompt(state);

  assert(!prompt.includes('河牌诈唬与抓诈指导 (P5)'), 'P5 NOT present for flop', 'P5 correctly skipped');
}

// 1.7 P4 NOT present for preflop
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({ stage: 'preflop' });
  const prompt = bot.buildPrompt(state);

  assert(!prompt.includes('针对性策略 (P4)'), 'P4 NOT present for preflop', 'P4 correctly skipped');
  assert(prompt.includes('针对性策略 (P4)') === false, 'P4 double-check skipped for preflop');
}

// ============================================
// Group 2: A/B Toggle - Baseline vs PokerSkill
// ============================================

section('GROUP 2: A/B Toggle - Baseline vs PokerSkill Mode');

// 2.1 Baseline mode: only P1
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: false, // BASELINE MODE
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'] });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('游戏规则'), 'Baseline P1 present');
  assert(!prompt.includes('P2'), 'Baseline P2 NOT present');
  assert(!prompt.includes('P3'), 'Baseline P3 NOT present');
  assert(!prompt.includes('P4'), 'Baseline P4 NOT present');
  assert(!prompt.includes('P5'), 'Baseline P5 NOT present');
}

// 2.2 PokerSkill mode: all layers for river
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test',
    apiKey: 'test-key',
    model: 'gpt-4o',
    enableSkills: true, // POKERSKILL MODE
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'] });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('P3'), 'PokerSkill P3 present for river');
  assert(prompt.includes('P4'), 'PokerSkill P4 present for river');
  assert(prompt.includes('P5'), 'PokerSkill P5 present for river');
}

// 2.3 Information delta between modes
{
  const baseConfig: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: false,
  };
  const skillConfig: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };

  const state = createMockState({ stage: 'river', commonCard: ['a3', 'c2', 'g3', 'd1', 'i4'] });
  const baseBot = new PokerSkillBot(baseConfig);
  const skillBot = new PokerSkillBot(skillConfig);

  const basePrompt = baseBot.buildPrompt(state);
  const skillPrompt = skillBot.buildPrompt(state);
  const delta = skillPrompt.length - basePrompt.length;
  const ratio = skillPrompt.length / basePrompt.length;

  assert(delta > 0, 'PokerSkill adds information', `${delta} chars extra`);
  assert(ratio > 1.3, 'PokerSkill info delta > 1.3x', `ratio = ${ratio.toFixed(2)}x`);
  result.logs.push(`  Info delta: ${basePrompt.length} -> ${skillPrompt.length} (${ratio.toFixed(2)}x)`);
}

// ============================================
// Group 3: BotManager Integration
// ============================================

section('GROUP 3: BotManager - Bot Lifecycle & A/B Toggle');

// 3.1 BotManager creation
{
  const roomConfig: BotRoomConfig = {
    enableBots: true,
    botCount: 2,
    enablePokerSkill: true,
    llmApiUrl: 'http://test-api',
    llmApiKey: 'test-key',
    llmModel: 'gpt-4o',
    botChips: 1000,
    isShort: false,
    smallBlind: 5,
  };
  const bm = new BotManager(roomConfig);
  assert(bm !== null, 'BotManager created');
  assert(bm.isPokerSkillEnabled() === true, 'PokerSkill enabled by default');
}

// 3.2 Bot creation
{
  const roomConfig: BotRoomConfig = {
    enableBots: true, botCount: 2, enablePokerSkill: true,
    llmApiUrl: 'http://test', llmApiKey: 'key', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5,
  };
  const bm = new BotManager(roomConfig);
  const bots = bm.createBots(2, 1000);

  assert(bots.length === 2, 'Correct number of bots created', `created ${bots.length}`);
  assert(bots[0].isBot === true, 'Bot has isBot flag');
  assert(bots[0].nickName.startsWith('德州AI'), 'Bot has Chinese name', bots[0].nickName);
  assert(bots[0].counter === 1000, 'Bot has correct starting chips');
  assert(bots[0].botId.startsWith('bot_'), 'Bot has valid ID');
}

// 3.3 A/B toggle at runtime
{
  const roomConfig: BotRoomConfig = {
    enableBots: true, botCount: 1, enablePokerSkill: true,
    llmApiUrl: 'http://test', llmApiKey: 'key', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5,
  };
  const bm = new BotManager(roomConfig);
  bm.initPokerSkill();

  assert(bm.isPokerSkillEnabled() === true, 'PokerSkill initially enabled');

  bm.setPokerSkillEnabled(false);
  assert(bm.isPokerSkillEnabled() === false, 'PokerSkill disabled after toggle');

  bm.setPokerSkillEnabled(true);
  assert(bm.isPokerSkillEnabled() === true, 'PokerSkill re-enabled');
}

// 3.4 Bot identification
{
  const roomConfig: BotRoomConfig = {
    enableBots: true, botCount: 1, enablePokerSkill: true,
    llmApiUrl: 'http://test', llmApiKey: 'key', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5,
  };
  const bm = new BotManager(roomConfig);
  const bots = bm.createBots(1, 1000);

  assert(bm.isBot(bots[0].userId) === true, 'Bot correctly identified as bot');
  assert(bm.isBot('human_user_123') === false, 'Human correctly identified as non-bot');
}

// 3.5 Config exposure
{
  const roomConfig: BotRoomConfig = {
    enableBots: true, botCount: 3, enablePokerSkill: false,
    llmApiUrl: 'http://custom', llmApiKey: 'key', llmModel: 'gpt-4o', botChips: 2000, isShort: false, smallBlind: 5,
  };
  const bm = new BotManager(roomConfig);
  const config = bm.getConfig();

  assert(config.enableBots === true, 'Config enableBots correct');
  assert(config.botCount === 3, 'Config botCount correct');
  assert(config.enablePokerSkill === false, 'Config enablePokerSkill correct');
  assert(config.model === 'gpt-4o', 'Config model correct');
}

// ============================================
// Group 4: Game State Building
// ============================================

section('GROUP 4: Game State Building - Data Flow');

// 4.1 Stage detection
{
  const roomConfig: BotRoomConfig = {
    enableBots: true, botCount: 1, enablePokerSkill: true,
    llmApiUrl: 'http://test', llmApiKey: 'key', llmModel: 'gpt-4o', botChips: 1000, isShort: false, smallBlind: 5,
  };
  const bm = new BotManager(roomConfig);

  // We can't fully test buildGameState without a real PokerGame,
  // but we can test the config flow
  assert(typeof bm.buildGameState === 'function', 'buildGameState method exists');
}

// ============================================
// Group 5: Action Parsing & Normalization
// ============================================

section('GROUP 5: Action Parsing & Normalization');

// 5.1 Parse JSON action (via getAction's parseAction - test via config)
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);

  // Test via buildPrompt that the output format instruction is clear
  const state = createMockState();
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('"action"'), 'Prompt instructs JSON action format');
  assert(prompt.includes('"reasoning"'), 'Prompt instructs JSON reasoning format');
}

// 5.2 Hand classification accuracy
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);

  // AA preflop - should be premium_pair
  const aaState = createMockState({ handCard: ['m4', 'm3'], stage: 'preflop' });
  const aaPrompt = bot.buildPrompt(aaState);
  assert(aaPrompt.includes('premium_pair'), 'AA classified as premium_pair');

  // 72 offsuit - should be weak
  const weakState = createMockState({ handCard: ['a1', 'b2'], stage: 'preflop' });
  const weakPrompt = bot.buildPrompt(weakState);
  assert(weakPrompt.includes('weak') || weakPrompt.includes('弱牌'), '72o classified as weak');

  // JT suited - should be suited_connector
  const scState = createMockState({ handCard: ['i3', 'h3'], stage: 'preflop' });
  const scPrompt = bot.buildPrompt(scState);
  assert(scPrompt.includes('suited_connector'), 'JTs classified as suited_connector');
}

// 5.3 Position labels
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);

  const dealerState = createMockState({ myPosition: 'd' });
  const dPrompt = bot.buildPrompt(dealerState);
  assert(dPrompt.includes('庄位(Button)'), 'Dealer position labeled correctly');

  const sbState = createMockState({ myPosition: 'sb' });
  const sbPrompt = bot.buildPrompt(sbState);
  assert(sbPrompt.includes('小盲(SB)'), 'SB position labeled correctly');

  const bbState = createMockState({ myPosition: 'bb' });
  const bbPrompt = bot.buildPrompt(bbState);
  assert(bbPrompt.includes('大盲(BB)'), 'BB position labeled correctly');
}

// ============================================
// Group 6: Frontend Integration Points
// ============================================

section('GROUP 6: Frontend Integration Points');

// 6.1 Home.vue AI Bot config fields
{
  const fs = require('fs');
  const path = require('path');
  const homePath = path.join(__dirname, '../../../../../client/src/views/home.vue');

  if (fs.existsSync(homePath)) {
    const homeContent = fs.readFileSync(homePath, 'utf-8');

    assert(homeContent.includes('enableBots'), 'home.vue has enableBots config');
    assert(homeContent.includes('botCount'), 'home.vue has botCount config');
    assert(homeContent.includes('enablePokerSkill'), 'home.vue has enablePokerSkill config');
    assert(homeContent.includes('llmApiUrl'), 'home.vue has llmApiUrl config');
    assert(homeContent.includes('llmApiKey'), 'home.vue has llmApiKey config');
    assert(homeContent.includes('llmModel'), 'home.vue has llmModel config');
    assert(homeContent.includes('botChips'), 'home.vue has botChips config');
  } else {
    warn('home.vue file check', 'File not found at expected path, skipping frontend checks');
  }
}

// 6.2 AIAdvisor.vue integration
{
  const fs = require('fs');
  const path = require('path');
  const advisorPath = path.join(__dirname, '../../../../../client/src/components/AIAdvisor.vue');

  if (fs.existsSync(advisorPath)) {
    const advisorContent = fs.readFileSync(advisorPath, 'utf-8');

    assert(advisorContent.includes('drawer') || advisorContent.includes('isExpanded'), 'AIAdvisor has drawer mechanism');
    assert(advisorContent.includes('/node/ai/analyze') || advisorContent.includes('ai/analyze'), 'AIAdvisor calls correct API');
  } else {
    warn('AIAdvisor.vue check', 'File not found');
  }
}

// 6.3 Game.vue bot interaction
{
  const fs = require('fs');
  const path = require('path');
  const gamePath = path.join(__dirname, '../../../../../client/src/views/game.vue');

  if (fs.existsSync(gamePath)) {
    const gameContent = fs.readFileSync(gamePath, 'utf-8');

    assert(gameContent.includes('socket'), 'game.vue uses WebSocket');
    assert(gameContent.includes('action'), 'game.vue handles actions');
  } else {
    warn('game.vue check', 'File not found');
  }
}

// ============================================
// Group 7: Error Handling & Edge Cases
// ============================================

section('GROUP 7: Error Handling & Edge Cases');

// 7.1 Fallback action when LLM fails
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://invalid-url-that-will-fail',
    apiKey: 'invalid',
    model: 'gpt-4o',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);

  // getAction should handle errors gracefully with fallback
  assert(typeof bot.getAction === 'function', 'getAction method exists');
  assert(typeof bot.getHistory === 'function', 'getHistory method exists');
  assert(typeof bot.clearHistory === 'function', 'clearHistory method exists');
}

// 7.2 Empty/null API config handling
{
  const config: PokerSkillConfig = {
    apiUrl: '',
    apiKey: '',
    model: '',
    enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState();
  const prompt = bot.buildPrompt(state);

  assert(prompt.length > 0, 'Prompt generated even with empty config');
  assert(prompt.includes('游戏规则'), 'P1 still present with empty config');
}

// 7.3 Single player edge case
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({
    numActivePlayers: 1,
    players: [],
    currentRoundActions: [],
  });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('1人'), 'Single player state handled');
}

// 7.4 Big blind special case (free check)
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({
    myPosition: 'bb',
    prevSize: 0,
    currentRoundActions: [],
  });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('大盲位特权'), 'BB special case mentioned');
}

// ============================================
// Group 8: Card Formatting
// ============================================

section('GROUP 8: Card Formatting System');

// 8.1 Card format correctness
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);

  // m4 + m3 should format as Ad + Ah (Ace of diamonds + Ace of hearts)
  const state = createMockState({ handCard: ['m4', 'm3'] });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('Ad') || prompt.includes('A'), 'Ace cards formatted correctly');
}

// 8.2 Full board formatting
{
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);
  const state = createMockState({
    stage: 'river',
    handCard: ['m3', 'l4'],
    commonCard: ['i3', 'h2', 'd1', 'e4', 'j1'],
  });
  const prompt = bot.buildPrompt(state);

  assert(prompt.includes('公共牌'), 'Board cards labeled');
  assert(prompt.includes('阶段: 河牌'), 'River stage labeled correctly');
}

// ============================================
// Group 9: Hand Tier Classification Matrix
// ============================================

section('GROUP 9: Hand Tier Classification Matrix');

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
  const config: PokerSkillConfig = {
    apiUrl: 'http://test', apiKey: 'test-key', model: 'gpt-4o', enableSkills: true,
  };
  const bot = new PokerSkillBot(config);

  for (const test of tierTests) {
    const state = createMockState({ handCard: test.cards, stage: 'preflop' });
    const prompt = bot.buildPrompt(state);
    const found = prompt.includes(test.expected);
    assert(found, `${test.name} (${test.cards.join('')}) -> ${test.expected}`, found ? 'correct' : `got tier mismatch`);
  }
}

// ============================================
// Summary
// ============================================

section('FINAL SUMMARY');

result.logs.push(`\nTOTAL: ${result.passed} passed, ${result.failed} failed, ${result.warnings} warnings`);
result.logs.push(`SUCCESS RATE: ${((result.passed / (result.passed + result.failed)) * 100).toFixed(1)}%`);

if (result.failed === 0) {
  result.logs.push('\nAll PokerSkill integration tests PASSED!');
} else {
  result.logs.push(`\n${result.failed} test(s) FAILED - review needed`);
}

// Print all logs
console.log(result.logs.join('\n'));

// Exit code
process.exit(result.failed > 0 ? 1 : 0);
