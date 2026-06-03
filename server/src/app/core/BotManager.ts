/**
 * BotManager - AI bot lifecycle management for Texas Hold'em games
 *
 * Handles:
 * - Adding/removing bot players to rooms
 * - Auto-action when it's a bot's turn
 * - PokerSkill integration with toggle switch
 */

import { IPlayer, ECommand } from './Player';
import { PokerGame, EGameStatus } from './PokerGame';
import { PokerSkillBot, GameStateForBot, PokerSkillConfig, BotPlayerInfo } from './PokerSkillBot';
import { IRoomInfo, ISit, IRoomConfig } from '../../../interface/IGameRoom';

/** Extended room config for bot support */
export interface BotRoomConfig extends IRoomConfig {
  /** Enable AI bot players */
  enableBots?: boolean;
  /** Number of bots to add */
  botCount?: number;
  /** Enable PokerSkill layers (false = baseline/simple prompt mode) */
  enablePokerSkill?: boolean;
  /** LLM API URL */
  llmApiUrl?: string;
  /** LLM API Key */
  llmApiKey?: string;
  /** LLM Model */
  llmModel?: string;
  /** Bot starting chips */
  botChips?: number;
}

export interface BotPlayer extends IPlayer {
  isBot: true;
  botId: string;
}

const BOT_NAMES = ['德州AI-α', '德州AI-β', '德州AI-γ', '德州AI-δ', '德州AI-ε', '德州AI-ζ', '德州AI-η', '德州AI-θ'];

export class BotManager {
  private bots: Map<string, BotPlayer> = new Map();
  private pokerSkillBot: PokerSkillBot | null = null;
  private roomConfig: BotRoomConfig;
  private actionQueue: Map<string, boolean> = new Map(); // botId -> isThinking

  constructor(roomConfig: BotRoomConfig) {
    this.roomConfig = roomConfig;
  }

  /**
   * Initialize the PokerSkill engine
   */
  initPokerSkill(): void {
    const config: PokerSkillConfig = {
      apiUrl: this.roomConfig.llmApiUrl || process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
      apiKey: this.roomConfig.llmApiKey || process.env.LLM_API_KEY || '',
      model: this.roomConfig.llmModel || process.env.LLM_MODEL || 'gpt-4o',
      enableSkills: this.roomConfig.enablePokerSkill !== false, // Default: enabled
    };
    this.pokerSkillBot = new PokerSkillBot(config);
  }

  /**
   * Check if PokerSkill is enabled
   */
  isPokerSkillEnabled(): boolean {
    return this.roomConfig.enablePokerSkill !== false && this.pokerSkillBot !== null;
  }

  /**
   * Toggle PokerSkill on/off at runtime
   */
  setPokerSkillEnabled(enabled: boolean): void {
    this.roomConfig.enablePokerSkill = enabled;
    if (this.pokerSkillBot) {
      const config = (this.pokerSkillBot as any).config;
      if (config) {
        config.enableSkills = enabled;
      }
    }
  }

  /**
   * Create bot players and add them to the room
   */
  createBots(count: number, startingChips: number): BotPlayer[] {
    const newBots: BotPlayer[] = [];
    for (let i = 0; i < count; i++) {
      const botId = `bot_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const nameIdx = this.bots.size + i;
      const bot: BotPlayer = {
        isBot: true,
        botId,
        userId: botId,
        nickName: BOT_NAMES[nameIdx % BOT_NAMES.length],
        account: `bot_${i}`,
        socketId: `bot_socket_${botId}`,
        counter: startingChips,
        buyIn: startingChips,
        type: '',
        reBuy: 0,
        status: 1,
        actionSize: 0,
        actionCommand: '',
        delayCount: 3,
        gameCount: 0,
        voluntaryActionCountAtPreFlop: 0,
        actionCountAtPreFlop: 0,
        walksCountAtPreFlop: 0,
        winCountAtPreFlop: 0,
        raiseCountAtPreFlop: 0,
        hasStoodUp: false,
      };
      this.bots.set(botId, bot);
      newBots.push(bot);
    }
    return newBots;
  }

  /**
   * Get all bots
   */
  getBots(): BotPlayer[] {
    return Array.from(this.bots.values());
  }

  /**
   * Check if a player is a bot
   */
  isBot(userId: string): boolean {
    return this.bots.has(userId);
  }

  /**
   * Remove a bot
   */
  removeBot(botId: string): void {
    this.bots.delete(botId);
  }

  /**
   * Remove all bots
   */
  removeAllBots(): void {
    this.bots.clear();
    this.actionQueue.clear();
  }

  /**
   * Build game state for PokerSkill engine from current game state
   */
  buildGameState(
    game: PokerGame,
    botPlayer: IPlayer,
    roomInfo: IRoomInfo,
  ): GameStateForBot {
    const commonCardLength = game.commonCard.length;
    let stage: GameStateForBot['stage'] = 'preflop';
    if (commonCardLength >= 5) {
      stage = 'river';
    } else if (commonCardLength === 4) {
      stage = 'turn';
    } else if (commonCardLength === 3) {
      stage = 'flop';
    }

    // Find our bot in the game's allPlayer list
    const botGamePlayer = game.allPlayer.find(p => p.userId === botPlayer.userId);
    const handCard = botGamePlayer ? botGamePlayer.getHandCard() : [];

    // Build player info list (exclude ourselves)
    const players: BotPlayerInfo[] = [];
    for (const p of game.allPlayer) {
      if (p.userId === botPlayer.userId) continue;
      const roomPlayer = roomInfo.players.find(rp => rp.userId === p.userId);
      const vpip = roomPlayer
        ? (roomPlayer.voluntaryActionCountAtPreFlop || 0) /
          ((roomPlayer.actionCountAtPreFlop || 0) - (roomPlayer.walksCountAtPreFlop || 0) || 1)
        : undefined;
      const pfr = roomPlayer
        ? (roomPlayer.raiseCountAtPreFlop || 0) /
          ((roomPlayer.actionCountAtPreFlop || 0) - (roomPlayer.walksCountAtPreFlop || 0) || 1)
        : undefined;
      players.push({
        nickName: p.nickName,
        counter: p.counter,
        actionSize: p.actionSize,
        actionCommand: p.actionCommand,
        type: p.type,
        status: p.actionCommand === 'fold' ? 0 : 1,
        vpip,
        pfr,
      });
    }

    // Current round actions (simplified - just recent commands)
    const currentRoundActions = game.allPlayer
      .filter(p => p.actionCommand && p.actionCommand !== '')
      .map(p => ({
        nickName: p.nickName,
        action: p.actionCommand,
        stage,
      }));

    const result: GameStateForBot = {
      handCard,
      commonCard: game.commonCard,
      pot: game.pot,
      prevSize: (game as any).prevSize || 0,
      smallBlind: game['smallBlind'] || roomInfo.config.smallBlind,
      bigBlind: (game['smallBlind'] || roomInfo.config.smallBlind) * 2,
      myPosition: botGamePlayer?.type || '',
      myCounter: (botGamePlayer?.counter || 0),
      myActionSize: (botGamePlayer?.actionSize || 0),
      isShort: roomInfo.config.isShort || false,
      players,
      currentRoundActions,
      stage,
      numActivePlayers: game.playerSize || game.allPlayer.filter(p => p.actionCommand !== 'fold').length,
    };

    return result;
  }

  /**
   * Get action for a bot. Returns the action command string.
   * This is called when it's the bot's turn.
   */
  async getBotAction(
    game: PokerGame,
    botPlayer: any,
    roomInfo: IRoomInfo,
  ): Promise<string> {
    const botId = botPlayer.userId;

    // Prevent duplicate actions
    if (this.actionQueue.get(botId)) {
      console.log(`Bot ${botId} is already thinking, skipping...`);
      return 'fold'; // fallback
    }

    this.actionQueue.set(botId, true);

    try {
      if (!this.pokerSkillBot) {
        this.initPokerSkill();
      }

      const state = this.buildGameState(game, botPlayer, roomInfo);

      if (!this.pokerSkillBot) {
        // No LLM configured, use simple fallback
        return this.simpleBotAction(state);
      }

      const { action } = await this.pokerSkillBot.getAction(state);

      // Map action to game command format
      const command = this.mapActionToCommand(action, state);

      return command;
    } catch (e: any) {
      console.error(`Bot ${botId} action error:`, e.message);
      return this.simpleBotAction(
        this.buildGameState(game, botPlayer, roomInfo),
      );
    } finally {
      this.actionQueue.delete(botId);
    }
  }

  /**
   * Map PokerSkill action to game command format
   */
  private mapActionToCommand(action: string, state: GameStateForBot): string {
    // Already in correct format
    if (['fold', 'check', 'call', 'allin'].includes(action)) {
      return action;
    }

    // raise:XXX format
    if (action.startsWith('raise:')) {
      const size = parseInt(action.split(':')[1], 10);
      if (isNaN(size) || size <= 0) {
        return 'call';
      }
      // Ensure raise is valid (at least 2x previous size or 2x big blind)
      const minRaise = Math.max(state.prevSize * 2, state.bigBlind * 2);
      const adjustedSize = Math.max(size, minRaise);
      return `raise:${adjustedSize}`;
    }

    return 'fold'; // fallback
  }

  /**
   * Simple rule-based bot action (no LLM)
   */
  private simpleBotAction(state: GameStateForBot): string {
    const hand = state.handCard;
    const hasPair = hand.length === 2 && hand[0][0] === hand[1][0];
    const highCards = hand.filter(c => 'jklm'.includes(c[0]));

    // Very simple heuristic
    if (state.stage === 'preflop') {
      if (hasPair && highCards.length === 2) {
        // Premium pair (JJ+)
        return state.prevSize > 0 ? `raise:${state.prevSize * 3}` : `raise:${state.bigBlind * 3}`;
      }
      if (hasPair || highCards.length >= 1) {
        return state.prevSize > 0 ? 'call' : `raise:${state.bigBlind * 2}`;
      }
      if (state.prevSize === 0 && state.myPosition === 'bb') {
        return 'check';
      }
      return state.prevSize > state.bigBlind * 4 ? 'fold' : 'call';
    }

    // Postflop: simple play
    if (state.prevSize === 0 || state.myActionSize >= state.prevSize) {
      return Math.random() > 0.5 ? `raise:${state.pot}` : 'check';
    }
    if (state.prevSize > state.pot * 0.5) {
      return Math.random() > 0.7 ? 'call' : 'fold';
    }
    return 'call';
  }

  /**
   * Get the PokerSkill config for status display
   */
  getConfig(): {
    enableBots: boolean;
    botCount: number;
    enablePokerSkill: boolean;
    model: string;
  } {
    return {
      enableBots: this.roomConfig.enableBots || false,
      botCount: this.roomConfig.botCount || 0,
      enablePokerSkill: this.roomConfig.enablePokerSkill !== false,
      model: this.roomConfig.llmModel || 'gpt-4o',
    };
  }
}
