import { IPlayer } from '../app/core/Player';
import { PokerGame } from '../app/core/PokerGame';
import { BotManager, BotRoomConfig } from '../app/core/BotManager';
import { ILinkNode } from '../utils/Link';

export interface IGameRoom {
  number: string;
  roomInfo: IRoomInfo;
}

export interface ISit {
  player?: IPlayer;
  position: number;
}

/**
 * Room config with bot and PokerSkill support
 */
export interface IRoomConfig {
  isShort: boolean;
  smallBlind: number;
  time?: number;
  /** Enable AI bot players */
  enableBots?: boolean;
  /** Number of bots to add (default: 1) */
  botCount?: number;
  /** Enable PokerSkill layers (default: true when enableBots is true) */
  enablePokerSkill?: boolean;
  /** LLM API URL for bot decisions */
  llmApiUrl?: string;
  /** LLM API Key */
  llmApiKey?: string;
  /** LLM Model name */
  llmModel?: string;
  /** Bot starting chips (default: 1000) */
  botChips?: number;
}

export interface IRoomInfo {
  players: IPlayer[];
  sit: ISit[];
  game: PokerGame | null;
  sitLink: ILinkNode<IPlayer> | null;
  gameId?: number;
  config: IRoomConfig;
  /** Bot manager (set when bots are added) */
  botManager?: BotManager;
}
