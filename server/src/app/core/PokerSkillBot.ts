/**
 * PokerSkillBot - 5-layer PokerSkill architecture for LLM-based poker AI
 * Based on "PokerSkill: LLMs Can Play Expert-Level Poker without Training or Solvers"
 * (Li, Wang, Huang - Tsinghua University, 2026)
 *
 * Layers:
 *   P1: Game rules, execution framework, output format (always active)
 *   P2: Preflop GTO range guidance for the detected scenario
 *   P3: Postflop general principles + hand strength evaluation
 *   P4: Postflop targeted strategy (ATT/DEF budget, viable options)
 *   P5: River bluff/bluff-catch guidelines
 */

import { Poker } from './Poker';
import { ECommand } from './Player';

// ==========================================
// Card encoding: same as Poker.ts
// ==========================================
const CardNumberMap: Record<string, string> = {
  a: '2', b: '3', c: '4', d: '5', e: '6', f: '7', g: '8', h: '9',
  i: 'T', j: 'J', k: 'Q', l: 'K', m: 'A',
};
const CardSuitMap: Record<string, string> = {
  '1': 'd', '2': 'c', '3': 'h', '4': 's',
};

function formatCard(code: string): string {
  if (!code || code.length !== 2) return code;
  const rank = CardNumberMap[code[0]] || code[0];
  const suit = CardSuitMap[code[1]] || code[1];
  return rank + suit;
}

// ==========================================
// Interfaces
// ==========================================
export interface PokerSkillConfig {
  /** LLM API base URL */
  apiUrl: string;
  /** LLM API key */
  apiKey: string;
  /** Model name */
  model: string;
  /** Enable PokerSkill layers (false = baseline mode) */
  enableSkills: boolean;
  /** Temperature for LLM */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
}

export interface GameStateForBot {
  handCard: string[];
  commonCard: string[];
  pot: number;
  prevSize: number;
  smallBlind: number;
  bigBlind: number;
  myPosition: string; // 'd', 'sb', 'bb', or ''
  myCounter: number;
  myActionSize: number;
  isShort: boolean;
  players: BotPlayerInfo[];
  currentRoundActions: BotActionRecord[];
  stage: 'preflop' | 'flop' | 'turn' | 'river';
  numActivePlayers: number;
}

export interface BotPlayerInfo {
  nickName: string;
  counter: number;
  actionSize: number;
  actionCommand: string;
  type: string; // 'd', 'sb', 'bb', or ''
  status: number; // 1=active
  vpip?: number;
  pfr?: number;
}

export interface BotActionRecord {
  nickName: string;
  action: string;
  stage: string;
}

// ==========================================
// P1: Game Rules & Execution Framework
// ==========================================
const P1_GAME_RULES = `你是一位世界级的无限注德州扑克玩家。你必须在当前牌局中做出最优决策。

**游戏规则：**
- 这是无限注德州扑克（No-Limit Texas Hold'em）
- 你可以执行以下操作：fold（弃牌）、check（过牌）、call（跟注）、raise:XXX（加注到XXX）、allin（全下）
- 加注必须至少是前一个加注额的两倍，或至少是大盲注的两倍
- check 只有在当前无需跟注时才能使用
- 你必须在合法操作中选择一个

**输出格式（严格按照此格式，不要输出任何其他内容）：**
{ "action": "<action_type>", "reasoning": "<简短的中文理由>" }

action_type 必须是以下之一：
- "fold"
- "check"  
- "call"
- "raise:XXX" (XXX 是加注到的总额，整数)
- "allin"

示例输出：
{ "action": "raise:600", "reasoning": "手牌强，翻前加注建立底池" }
{ "action": "fold", "reasoning": "手牌太弱，面对大加注弃牌" }
{ "action": "call", "reasoning": "有隐含赔率，跟注看翻牌" }`;

// ==========================================
// P2: Preflop GTO Range Guidance
// ==========================================
function buildP2PreflopGuidance(state: GameStateForBot): string {
  const hand = state.handCard.map(formatCard).join(' ');
  const myPos = state.myPosition;
  const numPlayers = state.numActivePlayers;

  // Classify hand strength
  const ranks = state.handCard.map(c => CardNumberMap[c[0]] || c[0]);
  const suits = state.handCard.map(c => c[1]);
  const isPair = ranks[0] === ranks[1];
  const isSuited = suits[0] === suits[1];

  // Hand tier classification
  let tier: string;
  const highRank = ranks[0] > ranks[1] ? ranks[0] : ranks[1];
  const lowRank = ranks[0] > ranks[1] ? ranks[1] : ranks[0];
  const rankOrder = '23456789TJQKA';
  const highIdx = rankOrder.indexOf(highRank);
  const lowIdx = rankOrder.indexOf(lowRank);
  const gap = highIdx - lowIdx;

  if (isPair) {
    if ('JQKA'.includes(highRank)) tier = 'premium_pair';
    else if ('789T'.includes(highRank)) tier = 'medium_pair';
    else tier = 'low_pair';
  } else if (highIdx >= 10) { // T or better high card
    if (lowIdx >= 10 || (lowIdx >= 8 && isSuited)) tier = 'premium_broadway';
    else if (lowIdx >= 8) tier = 'strong_broadway';
    else if (isSuited && gap <= 2) tier = 'suited_connector';
    else tier = 'marginal_high';
  } else if (isSuited && gap <= 2 && highIdx >= 5) {
    tier = 'suited_connector';
  } else if (isPair || (isSuited && highIdx >= 8)) {
    tier = 'playable';
  } else {
    tier = 'weak';
  }

  // Position adjustments
  const posLabel = myPos === 'd' ? '庄位(Button)' : myPos === 'sb' ? '小盲(SB)' : myPos === 'bb' ? '大盲(BB)' : '中间位置';
  const isLatePosition = myPos === 'd' || myPos === '';
  const isEarlyPosition = myPos === 'sb' || myPos === 'bb';

  let guidance = `\n**翻前范围指导 (P2):**
- 手牌: ${hand} (${isPair ? '对子' : isSuited ? '同花' : '杂色'}${gap <= 1 && !isPair ? ', 连牌' : ''})
- 手牌等级: ${tier}
- 位置: ${posLabel}
- 在局人数: ${numPlayers}人
`;

  // Action recommendations based on tier + position
  const hasRaise = state.currentRoundActions.some(a => a.action.startsWith('raise') || a.action.startsWith('bet'));
  const hasCall = state.currentRoundActions.some(a => a.action === 'call');
  const raiseSize = state.prevSize;

  if (tier === 'premium_pair' || tier === 'premium_broadway') {
    if (!hasRaise) {
      guidance += `- **策略**: 强牌，应该加注。建议加注到 ${state.bigBlind * 3}~${state.bigBlind * 5}。`;
    } else {
      guidance += `- **策略**: 面对加注，应该再加注(3-bet)或跟注。`;
    }
  } else if (tier === 'medium_pair' || tier === 'strong_broadway') {
    if (isLatePosition) {
      guidance += `- **策略**: 后位强牌，可以加注。面对加注可以跟注。`;
    } else {
      guidance += `- **策略**: 前位中等牌力，可以考虑平跟或小额加注。`;
    }
  } else if (tier === 'low_pair' || tier === 'suited_connector') {
    guidance += `- **策略**: 投机牌。在后位且底池未被加注时可以跟注看翻牌。面对大加注建议弃牌。`;
  } else if (tier === 'marginal_high' || tier === 'playable') {
    guidance += `- **策略**: 边缘牌。后位且无人加注时可考虑跟注，前位或面对加注建议弃牌。`;
  } else {
    guidance += `- **策略**: 弱牌。大多数情况下应该弃牌，除非在大盲位且无人加注。`;
  }

  // Specific blind adjustments
  if (myPos === 'bb' && !hasRaise) {
    guidance += `\n- **大盲位特权**: 无人加注时可以免费看翻牌(check)。`;
  }
  if (myPos === 'sb' && !hasRaise && numPlayers <= 3) {
    guidance += `\n- **小盲位**: 少人局可考虑补齐盲注看翻牌。`;
  }

  return guidance;
}

// ==========================================
// P3: Postflop General Principles + Hand Strength
// ==========================================
function buildP3PostflopPrinciples(state: GameStateForBot): string {
  const hand = state.handCard.map(formatCard).join(' ');
  const board = state.commonCard.map(formatCard).join(' ');
  const stage = state.stage;

  let guidance = `\n**翻后通用原则与牌力评估 (P3):**
- 手牌: ${hand}
- 公共牌: ${board || '无'}
- 阶段: ${stage}
- 底池: ${state.pot}
`;

  // Hand strength categories
  const allCards = [...state.handCard.map(formatCard), ...state.commonCard.map(formatCard)];
  const allRanks = allCards.map(c => c[0]);
  const allSuits = allCards.map(c => c[c.length - 1]);

  // Count suit frequencies
  const suitCounts: Record<string, number> = {};
  allSuits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
  const flushDraw = Object.values(suitCounts).some(c => c >= 4);
  const flushMade = Object.values(suitCounts).some(c => c >= 5);

  // Check for straight potential
  const rankOrder = '23456789TJQKA';
  const rankIndices = [...new Set(allRanks.map(r => rankOrder.indexOf(r)))].sort((a, b) => a - b);
  let straightDraw = false;
  let straightMade = false;
  for (let i = 0; i <= rankIndices.length - 4; i++) {
    const consecutive = rankIndices.slice(i, i + 5);
    if (consecutive.length === 5 && consecutive[4] - consecutive[0] === 4) {
      straightMade = true;
      break;
    }
  }
  // Check near-straight (4 consecutive)
  for (let i = 0; i <= rankIndices.length - 4; i++) {
    const consecutive = rankIndices.slice(i, i + 4);
    if (consecutive.length === 4 && consecutive[3] - consecutive[0] === 3) {
      straightDraw = true;
      break;
    }
  }
  // Also check for 3 consecutive with 1 gap (gutshot)
  if (!straightDraw) {
    for (let i = 0; i <= rankIndices.length - 3; i++) {
      const gap = rankIndices[i + 2] - rankIndices[i];
      if (gap <= 3) straightDraw = true;
    }
  }

  // Hand strength assessment
  if (flushMade || straightMade) {
    guidance += `- **牌力**: 极强 (已成同花/顺子)\n`;
    guidance += `- **策略**: 积极进攻，建立底池价值。考虑加注甚至全下。`;
  } else if (flushDraw || straightDraw) {
    guidance += `- **牌力**: 中等 (${flushDraw ? '同花听牌' : ''}${flushDraw && straightDraw ? '/' : ''}${straightDraw ? '顺子听牌' : ''})\n`;
    guidance += `- **策略**: 有发展潜力的听牌。如赔率合适可以跟注，半诈唬加注也是选项。`;
  } else {
    // Check for pairs
    const rankCounts: Record<string, number> = {};
    allRanks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
    const counts = Object.values(rankCounts);
    if (counts.some(c => c >= 3)) {
      guidance += `- **牌力**: 强 (三条/葫芦可能)\n`;
      guidance += `- **策略**: 强牌，持续下注获取价值。`;
    } else if (counts.filter(c => c >= 2).length >= 2) {
      guidance += `- **牌力**: 强 (两对)\n`;
      guidance += `- **策略**: 有价值的牌，适度下注。`;
    } else if (counts.some(c => c >= 2)) {
      guidance += `- **牌力**: 中等 (一对)\n`;
      const pairRank = Object.entries(rankCounts).find(([_, c]) => c >= 2)?.[0] || '';
      const pairIdx = rankOrder.indexOf(pairRank);
      if (pairIdx >= 10) {
        guidance += `- **策略**: 顶对大踢脚，可以持续下注。需注意对手可能的强牌。`;
      } else if (pairIdx >= 8) {
        guidance += `- **策略**: 中等对子，控池为主，可以考虑过牌或小额下注。`;
      } else {
        guidance += `- **策略**: 小对子，容易被压制，建议过牌或面对下注时弃牌。`;
      }
    } else {
      guidance += `- **牌力**: 弱 (高牌)\n`;
      guidance += `- **策略**: 没有成牌。可以考虑诈唬（如果牌面有利于你的范围）或过牌弃牌。`;
    }
  }

  // Pot odds reminder
  if (state.prevSize > 0) {
    const potOdds = state.prevSize / (state.pot + state.prevSize);
    guidance += `\n- **底池赔率**: 需跟注 ${state.prevSize} 赢 ${state.pot + state.prevSize} (${(potOdds * 100).toFixed(0)}%)`;
  }

  return guidance;
}

// ==========================================
// P4: Postflop Targeted Strategy
// ==========================================
function buildP4TargetedStrategy(state: GameStateForBot): string {
  const stage = state.stage;
  if (stage === 'preflop') return ''; // P4 only applies postflop

  const numPlayers = state.numActivePlayers;
  const hasAggressor = state.currentRoundActions.some(
    a => a.action.startsWith('raise') || a.action.startsWith('bet') || a.action === 'allin'
  );
  const isHeadsUp = numPlayers <= 2;

  let guidance = `\n**针对性策略 (P4):**
- 在局人数: ${numPlayers}
- 底池状态: ${hasAggressor ? '有人进攻' : '无人进攻'}
- 局面: ${isHeadsUp ? '单挑' : '多人底池'}
`;

  // ATT/DEF budget concept
  if (hasAggressor) {
    guidance += `- **防守模式**: 对手展示了进攻意图。`;
    guidance += `\n  * 强牌: 可以跟注或再加注`;
    guidance += `\n  * 听牌: 根据底池赔率决定是否跟注`;
    guidance += `\n  * 弱牌: 弃牌是合理的`;
    guidance += `\n  * 诈唬加注: ${isHeadsUp ? '单挑局可以考虑' : '多人局不建议'}诈唬加注`;
  } else {
    guidance += `- **进攻模式**: 你有主动权。`;
    if (isHeadsUp) {
      guidance += `\n  * 持续下注(C-bet): 单挑局建议高频率下注 (~70%)`;
      guidance += `\n  * 下注大小: 建议 ${Math.floor(state.pot * 0.5)}~${Math.floor(state.pot * 0.75)} (半池到3/4池)`;
    } else {
      guidance += `\n  * 多人局需更谨慎，用强牌下注，中等牌过牌控池`;
      guidance += `\n  * 下注大小: 建议 ${Math.floor(state.pot * 0.6)}~${Math.floor(state.pot)} (2/3池到满池)`;
    }
  }

  return guidance;
}

// ==========================================
// P5: River Bluff/Bluff-Catch Guidelines
// ==========================================
function buildP5RiverGuidance(state: GameStateForBot): string {
  if (state.stage !== 'river') return '';

  const board = state.commonCard.map(formatCard).join(' ');

  let guidance = `\n**河牌诈唬与抓诈指导 (P5):**
- 公共牌: ${board}
`;

  // Simplified bluff guidelines
  guidance += `\n**诈唬条件检查:**
- 你的手牌是否有摊牌价值? 如果没有，可以考虑诈唬
- 牌面是否有完成的听牌（同花/顺子可能）? 可以代表这些牌诈唬
- 对手的范围是否受限? 受限的范围更容易被诈唬

**抓诈条件检查:**
- 你是否有中等强度的成牌? 可以考虑抓诈
- 对手的故事是否连贯? 不连贯的下注可能是诈唬
- 底池赔率是否合适? 抓诈需要好的赔率
`;

  return guidance;
}

// ==========================================
// PokerSkillBot Class
// ==========================================
export class PokerSkillBot {
  private config: PokerSkillConfig;
  private handHistory: string[] = [];

  constructor(config: PokerSkillConfig) {
    this.config = {
      temperature: 0.3,
      maxTokens: 512,
      ...config,
    };
  }

  /**
   * Build the full prompt using the 5-layer architecture
   */
  buildPrompt(state: GameStateForBot): string {
    const parts: string[] = [];

    // P1: Always - Game rules and output format
    parts.push(P1_GAME_RULES);

    if (this.config.enableSkills) {
      // P2: Preflop guidance
      if (state.stage === 'preflop') {
        const p2 = buildP2PreflopGuidance(state);
        if (p2) parts.push(p2);
      }

      // P3: Postflop principles (always useful for context)
      if (state.stage !== 'preflop') {
        const p3 = buildP3PostflopPrinciples(state);
        if (p3) parts.push(p3);
      }

      // P4: Targeted strategy (postflop only)
      const p4 = buildP4TargetedStrategy(state);
      if (p4) parts.push(p4);

      // P5: River guidance
      if (state.stage === 'river') {
        const p5 = buildP5RiverGuidance(state);
        if (p5) parts.push(p5);
      }
    }

    // Current situation (always included)
    parts.push(this.buildSituationPrompt(state));

    return parts.join('\n\n---\n\n');
  }

  /**
   * Build the current situation description
   */
  private buildSituationPrompt(state: GameStateForBot): string {
    const hand = state.handCard.map(formatCard).join(' ');
    const board = state.commonCard.length > 0 ? state.commonCard.map(formatCard).join(' ') : '无';
    const stageNames: Record<string, string> = {
      preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌',
    };

    const lines: string[] = [];
    lines.push(`**当前局面:**`);
    lines.push(`- 你的手牌: ${hand}`);
    lines.push(`- 公共牌: ${board}`);
    lines.push(`- 阶段: ${stageNames[state.stage] || state.stage}`);
    lines.push(`- 底池: ${state.pot}`);
    lines.push(`- 当前需要跟注: ${state.prevSize}`);
    lines.push(`- 你的筹码: ${state.myCounter}`);
    lines.push(`- 你已下注: ${state.myActionSize}`);
    lines.push(`- 盲注: ${state.smallBlind}/${state.bigBlind}`);
    lines.push(`- 在局活跃玩家: ${state.numActivePlayers}人`);

    // Player info
    if (state.players.length > 0) {
      lines.push(`\n**其他玩家:**`);
      for (const p of state.players) {
        const vpipStr = p.vpip !== undefined ? ` VPIP:${(p.vpip * 100).toFixed(0)}%` : '';
        const pfrStr = p.pfr !== undefined ? ` PFR:${(p.pfr * 100).toFixed(0)}%` : '';
        const actionStr = p.actionCommand ? ` [${p.actionCommand}${p.actionSize > 0 ? ':' + p.actionSize : ''}]` : '';
        const statusStr = p.status === 1 ? 'active' : 'folded';
        lines.push(`  * ${p.nickName}: ${p.counter}筹码 ${statusStr}${actionStr}${vpipStr}${pfrStr}`);
      }
    }

    // Recent actions
    if (state.currentRoundActions.length > 0) {
      lines.push(`\n**本轮操作记录:**`);
      const recent = state.currentRoundActions.slice(-10);
      for (const a of recent) {
        lines.push(`  * ${a.nickName}: ${a.action}`);
      }
    }

    // Legal actions hint
    const legals: string[] = [];
    if (state.prevSize === 0 || state.myActionSize >= state.prevSize) {
      legals.push('check');
    }
    if (state.prevSize > 0 && state.myActionSize < state.prevSize) {
      legals.push(`call (${state.prevSize - state.myActionSize})`);
    }
    legals.push('raise:XXX', 'allin', 'fold');
    lines.push(`\n**合法操作:** ${legals.join(', ')}`);

    return lines.join('\n');
  }

  /**
   * Get the action for the current game state by calling the LLM
   */
  async getAction(state: GameStateForBot): Promise<{ action: string; reasoning: string }> {
    const prompt = this.buildPrompt(state);

    try {
      const response = await this.callLLM(prompt);
      return this.parseAction(response);
    } catch (e: any) {
      console.error('PokerSkillBot LLM call failed:', e.message);
      // Fallback: check/fold based on situation
      if (state.prevSize === 0 || state.myActionSize >= state.prevSize) {
        return { action: 'check', reasoning: 'LLM调用失败，默认过牌' };
      }
      return { action: 'fold', reasoning: 'LLM调用失败，默认弃牌' };
    }
  }

  /**
   * Call the LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const url = this.config.apiUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    const body = JSON.stringify({
      model: this.config.model,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM API error: ${res.status} ${res.statusText}`);
      }

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';

      // Log for debugging
      this.handHistory.push(`[${new Date().toISOString()}] LLM response: ${content.slice(0, 200)}`);

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse LLM response into action + reasoning
   */
  private parseAction(response: string): { action: string; reasoning: string } {
    // Try JSON parsing
    try {
      // Extract JSON from response (may have markdown formatting)
      const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const action = this.normalizeAction(parsed.action);
        const reasoning = parsed.reasoning || '';
        return { action, reasoning };
      }
    } catch (e) {
      // Fall through to text parsing
    }

    // Fallback: try to extract action from plain text
    const actionPatterns = [
      { regex: /\b(?:action|操作|决定)\s*[:：]\s*(allin|all.in)\b/i, action: 'allin' },
      { regex: /\b(?:action|操作|决定)\s*[:：]\s*fold\b/i, action: 'fold' },
      { regex: /\b(?:action|操作|决定)\s*[:：]\s*check\b/i, action: 'check' },
      { regex: /\b(?:action|操作|决定)\s*[:：]\s*call\b/i, action: 'call' },
      { regex: /\b(?:action|操作|决定)\s*[:：]\s*raise\s*[:：]?\s*(\d+)/i, action: 'raise' },
      { regex: /"action"\s*:\s*"(allin)"/i, action: 'allin' },
      { regex: /"action"\s*:\s*"(fold)"/i, action: 'fold' },
      { regex: /"action"\s*:\s*"(check)"/i, action: 'check' },
      { regex: /"action"\s*:\s*"(call)"/i, action: 'call' },
      { regex: /"action"\s*:\s*"raise:(\d+)"/i, action: 'raise' },
    ];

    for (const p of actionPatterns) {
      const match = response.match(p.regex);
      if (match) {
        if (p.action === 'raise') {
          return { action: `raise:${match[1]}`, reasoning: '' };
        }
        return { action: p.action, reasoning: '' };
      }
    }

    // Ultimate fallback
    return { action: 'fold', reasoning: '无法解析LLM响应' };
  }

  /**
   * Validate and normalize action string
   */
  private normalizeAction(action: string): string {
    if (!action) return 'fold';

    const cleaned = action.toLowerCase().trim();

    if (['fold', 'check', 'call', 'allin', 'all_in', 'all-in'].includes(cleaned)) {
      return cleaned.replace('_', '').replace('-', '');
    }

    // Handle raise:XXX format
    const raiseMatch = cleaned.match(/raise\s*[:：]?\s*(\d+)/);
    if (raiseMatch) {
      return `raise:${raiseMatch[1]}`;
    }

    return 'fold';
  }

  /**
   * Get the action history for debugging
   */
  getHistory(): string[] {
    return this.handHistory;
  }

  /**
   * Clear action history
   */
  clearHistory(): void {
    this.handHistory = [];
  }
}
