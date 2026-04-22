/**
 * AI Context Management Module
 * Manages multi-turn conversation history, opponent profiles, and context compression
 * All state stored in localStorage, server stays stateless
 */

import service from '@/service';

// Poker card encoding maps (matches server/src/app/core/Poker.ts)
const CardNumberMap: Record<string, string> = {
  a: '2', b: '3', c: '4', d: '5', e: '6', f: '7', g: '8', h: '9', i: 'T', j: 'J', k: 'Q', l: 'K', m: 'A',
};
const CardColorMap: Record<string, string> = {
  '1': '♦', '2': '♣', '3': '♥', '4': '♠',
};

/**
 * Format a single poker card code to standard notation (e.g., 'b4' -> '3s')
 */
function formatPokerCard(code: string): string {
  if (!code || code.length !== 2) return code;
  const num = CardNumberMap[code[0]] || code[0];
  const suit = CardColorMap[code[1]] || code[1];
  return `${num}${suit}`;
}

/**
 * Format all poker card codes in a text string (handles multi-card strings)
 */
function formatPokerCards(text: string): string {
  return text.replace(/\b([a-m][1-4])\b/g, (match) => formatPokerCard(match));
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpponentProfile {
  nickName: string;
  gameCount: number;
  vpip: number;       // Voluntarily Put $ In Pot (0-1)
  pfr: number;        // Pre-Flop Raise (0-1)
  actionLog: string[]; // last 50 actions: "preflop:raise:4", "flop:call"
  showdownHands: string[]; // last 10: "Ah Kh on As Ks 7d 3c 2h"
}

export interface AIContextData {
  messages: ChatMessage[];
  opponentProfiles: Record<string, OpponentProfile>;
  roundSummary: string;
  roundCount: number;
}

const CONTEXT_KEY_PREFIX = 'ai_ctx_';
const MAX_MESSAGES = 20;
const MAX_TOTAL_CHARS = 3000;
const KEEP_RECENT = 6;
const MAX_ACTION_LOG = 50;
const MAX_SHOWDOWN_HANDS = 10;
const MAX_AGENT_PROMPT_CHARS = 300; // ~100 tokens

// Base system prompt - concise Chinese expert advisor
const BASE_SYSTEM_PROMPT = `你是一位德州扑克专家顾问。你必须使用中文回复，禁止使用英文。

分析时请包含以下内容：
1. 我的手牌情况（牌力评估）
2. 公共牌面分析
3. 对手的下注行为和风格
4. 建议的操作（弃牌/过牌/跟注/加注）及理由

语气自然、专业，像一位经验丰富的扑克教练在给我建议。不需要固定格式，自由发挥即可。牌面用 ♠♥♣♦ 符号展示。`;

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all|prior)\s+(instructions?|prompts?|rules?)/gi,
  /forget\s+(everything|all|previous|prior)/gi,
  /you\s+are\s+now/gi,
  /new\s+(instructions?|rules?|role)/gi,
  /<\s*system\s*>/gi,
  /reveal\s+(your|the|system)\s+(prompt|instructions?|rules?)/gi,
  /override\s+(previous|default|system)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /act\s+as\s+(if\s+you|a\s+different)/gi,
  /disregard\s+(all\s+)?(previous|above|prior)/gi,
];

/**
 * Sanitize user agent prompt to prevent injection
 */
export function sanitizeUserPrompt(text: string): string {
  if (!text) return '';
  let cleaned = text;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[filtered]');
  }
  // Remove any remaining suspicious bracket patterns
  cleaned = cleaned.replace(/\[(\/?system|\/?user|\/?assistant)\]/gi, '');
  return cleaned.trim().slice(0, MAX_AGENT_PROMPT_CHARS);
}

/**
 * Validate messages array from client - strip system messages for safety
 */
export function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(m => m.role !== 'system')
    .slice(0, 30); // max 30 messages
}

/**
 * Get stage name from community card count
 */
export function getStage(commonCardCount: number): string {
  if (commonCardCount === 0) return 'Preflop';
  if (commonCardCount === 3) return 'Flop';
  if (commonCardCount === 4) return 'Turn';
  if (commonCardCount === 5) return 'River';
  return 'Unknown';
}

/**
 * Build VPIP from player stats
 */
function calcVPIP(player: any): number {
  const vol = player.voluntaryActionCountAtPreFlop || 0;
  const total = player.actionCountAtPreFlop || 0;
  const walks = player.walksCountAtPreFlop || 0;
  const denom = total - walks;
  return denom > 0 ? vol / denom : 0;
}

/**
 * Build PFR from player stats
 */
function calcPFR(player: any): number {
  const raises = player.raiseCountAtPreFlop || 0;
  const total = player.actionCountAtPreFlop || 0;
  const walks = player.walksCountAtPreFlop || 0;
  const denom = total - walks;
  return denom > 0 ? raises / denom : 0;
}

// ==========================================
// AIContext class
// ==========================================

export class AIContext {
  public data: AIContextData;
  private roomId: string;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.data = this.load();
  }

  private storageKey(): string {
    return `${CONTEXT_KEY_PREFIX}${this.roomId}`;
  }

  private load(): AIContextData {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // corrupted data, start fresh
    }
    return {
      messages: [],
      opponentProfiles: {},
      roundSummary: '',
      roundCount: 0,
    };
  }

  public save(): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.data));
    } catch (e) {
      // localStorage full, try trimming
      this.trimForStorage();
      try {
        localStorage.setItem(this.storageKey(), JSON.stringify(this.data));
      } catch (e2) {
        // give up
      }
    }
  }

  private trimForStorage(): void {
    // Trim action logs
    for (const profile of Object.values(this.data.opponentProfiles)) {
      profile.actionLog = profile.actionLog.slice(-20);
      profile.showdownHands = profile.showdownHands.slice(-5);
    }
    // Trim messages
    if (this.data.messages.length > 10) {
      this.data.messages = this.data.messages.slice(-10);
    }
  }

  public addMessage(role: 'system' | 'user' | 'assistant', content: string): void {
    this.data.messages.push({ role, content });
    this.save();
  }

  /**
   * Update opponent profile from player data
   */
  public updateOpponentProfile(userId: string, player: any): void {
    if (!this.data.opponentProfiles[userId]) {
      this.data.opponentProfiles[userId] = {
        nickName: player.nickName || userId,
        gameCount: 0,
        vpip: 0,
        pfr: 0,
        actionLog: [],
        showdownHands: [],
      };
    }
    const profile = this.data.opponentProfiles[userId];
    profile.nickName = player.nickName || profile.nickName;
    profile.gameCount = player.gameCount || 0;
    profile.vpip = calcVPIP(player);
    profile.pfr = calcPFR(player);
    this.save();
  }

  /**
   * Log an opponent action
   */
  public logOpponentAction(userId: string, action: string, commonCardLength: number): void {
    if (!this.data.opponentProfiles[userId]) return;
    const stage = getStage(commonCardLength);
    const entry = `${stage}:${action}`;
    const log = this.data.opponentProfiles[userId].actionLog;
    log.push(entry);
    if (log.length > MAX_ACTION_LOG) {
      this.data.opponentProfiles[userId].actionLog = log.slice(-MAX_ACTION_LOG);
    }
    this.save();
  }

  /**
   * Record showdown data
   */
  public addShowdown(userId: string, handCard: string[], commonCard: string[]): void {
    if (!this.data.opponentProfiles[userId]) return;
    const hand = handCard.join(' ');
    const board = commonCard.join(' ');
    const entry = `${hand} on ${board}`;
    const hands = this.data.opponentProfiles[userId].showdownHands;
    hands.push(entry);
    if (hands.length > MAX_SHOWDOWN_HANDS) {
      this.data.opponentProfiles[userId].showdownHands = hands.slice(-MAX_SHOWDOWN_HANDS);
    }
    this.save();
  }

  /**
   * Build opponent profile text for AI prompt
   */
  public buildOpponentProfileText(): string {
    const entries: string[] = [];
    for (const [userId, profile] of Object.entries(this.data.opponentProfiles)) {
      if (profile.gameCount < 1) continue;
      const lines: string[] = [];
      lines.push(`Player "${profile.nickName}" (${profile.gameCount} hands):`);
      lines.push(`  VPIP: ${(profile.vpip * 100).toFixed(0)}%, PFR: ${(profile.pfr * 100).toFixed(0)}%`);
      // Recent actions (last 10)
      const recentActions = profile.actionLog.slice(-10);
      if (recentActions.length > 0) {
        lines.push(`  Recent actions: ${recentActions.join(', ')}`);
      }
      // Showdown hands (last 5)
      const recentHands = profile.showdownHands.slice(-5);
      if (recentHands.length > 0) {
        lines.push(`  Shown hands: ${recentHands.map(formatPokerCards).join('; ')}`);
      }
      entries.push(lines.join('\n'));
    }
    return entries.length > 0 ? entries.join('\n\n') : '';
  }

  /**
   * Build current situation prompt text
   */
  public buildSituationText(
    handCard: string[], commonCard: string[], pot: number,
    players: any[], prevSize: number, smallBlind: number,
    position: string | null, currentRoundActions: any[]
  ): string {
    const stage = getStage(commonCard.length);
    const lines: string[] = [];

    // Find current player's sit to get blind assignment (type)
    const mySit = position
      ? players.find((s: any) => s.player && String(s.position) === String(position))
      : null;
    const myType = mySit?.player?.type || '';
    const myPosLabel = myType === 'd' ? 'Dealer/Button'
      : myType === 'sb' ? 'Small Blind'
      : myType === 'bb' ? 'Big Blind'
      : position ? `Seat ${position}`
      : 'unknown';

    lines.push(`当前牌局情况:`);
    lines.push(`- 我的手牌: ${handCard.length > 0 ? handCard.map(formatPokerCard).join(' ') : '无'}`);
    lines.push(`- 公共牌: ${commonCard.length > 0 ? commonCard.map(formatPokerCard).join(' ') : '无'}`);
    lines.push(`- 阶段: ${stage}`);
    lines.push(`- 底池: ${pot}`);
    lines.push(`- 当前需跟注: ${prevSize}`);
    lines.push(`- 盲注: ${smallBlind}/${smallBlind * 2}`);
    lines.push(`- 我的位: ${myPosLabel}`);

    // Per-player info: chips, blind assignment, fold/active status
    if (players && players.length > 0) {
      const activePlayers = players.filter((s: any) => s.player && s.player.status === 1);
      const allSeated = players.filter((s: any) => s.player);
      lines.push(`- 在局玩家: ${activePlayers.length}/${allSeated.length}`);
      lines.push(`- 玩家详情:`);
      for (const sit of allSeated) {
        const p = sit.player;
        const posLabel = p.type === 'd' ? 'Dealer/Button' : p.type === 'sb' ? 'SB' : p.type === 'bb' ? 'BB' : `Seat ${sit.position}`;
        const statusLabel = p.status === 1 ? 'active' : 'folded/sitting out';
        const actionInfo = p.actionSize > 0 ? ` 下注${p.actionSize}` : '';
        lines.push(`    * ${p.nickName} (${posLabel}): ${p.counter}筹码 [${statusLabel}${actionInfo}]`);
      }
    }

    // Actions with parsed amounts
    if (currentRoundActions && currentRoundActions.length > 0) {
      lines.push(`- 本轮操作:`);
      for (const a of currentRoundActions) {
        lines.push(`    * ${a.nickName}: ${a.latestAction}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build the full messages array for the LLM API
   */
  public buildMessages(
    handCard: string[], commonCard: string[], pot: number,
    players: any[], prevSize: number, smallBlind: number,
    position: string | null, currentRoundActions: any[],
    agentPrompt?: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 1. Core system prompt with safety hardening
    messages.push({
      role: 'system',
      content: BASE_SYSTEM_PROMPT,
    });

    // 2. User agent style prompt (if set, wrapped in boundary markers)
    if (agentPrompt) {
      messages.push({
        role: 'system',
        content: `[USER_AGENT_STYLE_START]${agentPrompt}[USER_AGENT_STYLE_END]`,
      });
    }

    // 3. Compressed history summary (if exists)
    if (this.data.roundSummary) {
      messages.push({
        role: 'system',
        content: `[PREVIOUS ROUNDS SUMMARY]\n${this.data.roundSummary}`,
      });
    }

    // 4. Opponent profiles
    const profileText = this.buildOpponentProfileText();
    if (profileText) {
      messages.push({
        role: 'system',
        content: `[OPPONENT PROFILES]\n${profileText}`,
      });
    }

    // 5. Recent conversation history (last KEEP_RECENT)
    const recentMsgs = this.data.messages.slice(-KEEP_RECENT);
    messages.push(...recentMsgs);

    // 6. Current situation as new user message
    const situationText = this.buildSituationText(
      handCard, commonCard, pot, players,
      prevSize, smallBlind, position, currentRoundActions
    );
    messages.push({
      role: 'user',
      content: situationText,
    });

    return messages;
  }

  /**
   * Check if context needs compression
   */
  public needsCompression(): boolean {
    return this.data.messages.length > MAX_MESSAGES ||
      this.getTotalChars() > MAX_TOTAL_CHARS;
  }

  private getTotalChars(): number {
    return this.data.messages.reduce((sum, m) => sum + m.content.length, 0);
  }

  /**
   * Compress older messages using LLM (with fallback to rule-based)
   */
  public async compress(apiKey: string, apiUrl: string, model: string): Promise<void> {
    if (this.data.messages.length <= KEEP_RECENT) return;

    const olderMessages = this.data.messages.slice(0, -KEEP_RECENT);
    const recentMessages = this.data.messages.slice(-KEEP_RECENT);

    try {
      // Call server-side compression endpoint
      const result = await service.compressAIContext({
        messages: olderMessages,
        apiKey,
        apiUrl,
        model,
      });

      const summary = result.data?.summary || '';

      if (summary) {
        // Combine with existing round summary
        const combinedSummary = this.data.roundSummary
          ? `${this.data.roundSummary}\n\n${summary}`
          : summary;

        // Truncate if too long
        this.data.roundSummary = combinedSummary.length > 1000
          ? combinedSummary.slice(-1000)
          : combinedSummary;
      }
    } catch (e) {
      // Fallback: rule-based compression
      this.fallbackCompress(olderMessages);
    }

    // Keep only recent messages
    this.data.messages = recentMessages;
    this.data.roundCount++;
    this.save();
  }

  /**
   * Fallback rule-based compression
   */
  private fallbackCompress(olderMessages: ChatMessage[]): void {
    const parts: string[] = [];
    for (const msg of olderMessages) {
      if (msg.role === 'user') {
        parts.push(`Q: ${msg.content.slice(0, 100)}`);
      } else if (msg.role === 'assistant') {
        parts.push(`A: ${msg.content.slice(0, 100)}`);
      }
    }
    const summary = parts.join('\n');
    this.data.roundSummary = this.data.roundSummary
      ? `${this.data.roundSummary}\n\n${summary}`
      : summary;

    // Truncate
    if (this.data.roundSummary.length > 500) {
      this.data.roundSummary = this.data.roundSummary.slice(-500);
    }
  }

  /**
   * Reset for new round (keep profiles and summary)
   */
  public resetForNewRound(): void {
    this.data.messages = [];
    this.save();
  }

  /**
   * Full context clear
   */
  public clearContext(): void {
    this.data = {
      messages: [],
      opponentProfiles: {},
      roundSummary: '',
      roundCount: 0,
    };
    localStorage.removeItem(this.storageKey());
  }
}

/**
 * Get or create an AIContext for a room
 */
const contextCache: Record<string, AIContext> = {};

export function getAIContext(roomId: string): AIContext {
  if (!contextCache[roomId]) {
    contextCache[roomId] = new AIContext(roomId);
  }
  return contextCache[roomId];
}
