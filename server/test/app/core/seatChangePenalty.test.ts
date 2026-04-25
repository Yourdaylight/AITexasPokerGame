import { IPlayer } from '../../../src/app/core/Player';
import { IRoomInfo, ISit } from '../../../src/interface/IGameRoom';

describe('test/app/core/seatChangePenalty.test.ts', () => {
  const createPlayer = (userId: string, counter: number, hasStoodUp = false): IPlayer => ({
    userId,
    counter,
    nickName: userId,
    account: userId,
    socketId: userId,
    buyIn: counter,
    reBuy: 0,
    actionSize: 0,
    actionCommand: '',
    status: 0,
    type: '',
    delayCount: 3,
    gameCount: 0,
    voluntaryActionCountAtPreFlop: 0,
    actionCountAtPreFlop: 0,
    walksCountAtPreFlop: 0,
    winCountAtPreFlop: 0,
    raiseCountAtPreFlop: 0,
    hasStoodUp,
  });

  const createSit = (position: number, player?: IPlayer): ISit => ({
    position,
    player,
  });

  /**
   * Simulate the penalty logic from game.ts sitDown()
   */
  const applySeatChangePenalty = (roomInfo: IRoomInfo, userId: string): { success: boolean; totalPenalty: number; rejected: boolean } => {
    const player = roomInfo.players.find((p) => p.userId === userId);
    if (!player || !player.hasStoodUp || !roomInfo.game) {
      return { success: true, totalPenalty: 0, rejected: false };
    }

    const otherSeatedPlayers = roomInfo.sit.filter(
      (s) => s.player && s.player.userId !== userId && s.player.counter > 0
    );
    const penaltyPerPlayer = 50;
    const totalPenalty = otherSeatedPlayers.length * penaltyPerPlayer;

    if (player.counter < totalPenalty) {
      return { success: false, totalPenalty, rejected: true };
    }

    player.counter -= totalPenalty;
    otherSeatedPlayers.forEach((s) => {
      const p = roomInfo.players.find((rp) => rp.userId === s.player!.userId);
      if (p) {
        p.counter += penaltyPerPlayer;
        s.player!.counter = p.counter;
      }
    });
    player.hasStoodUp = false;

    return { success: true, totalPenalty, rejected: false };
  };

  it('should deduct penalty and distribute to other players when re-sitting during game', () => {
    const player1 = createPlayer('1', 500, true);
    const player2 = createPlayer('2', 400);
    const player3 = createPlayer('3', 300);

    const roomInfo: IRoomInfo = {
      players: [player1, player2, player3],
      sit: [
        createSit(1, player2),
        createSit(2, player3),
      ],
      game: {} as any, // simulate active game
      sitLink: null,
      config: { isShort: false, smallBlind: 1 },
    };

    const result = applySeatChangePenalty(roomInfo, '1');

    expect(result.success).toBe(true);
    expect(result.totalPenalty).toEqual(100); // 2 players * 50
    expect(result.rejected).toBe(false);

    // Player 1 should lose 100
    expect(player1.counter).toEqual(400);
    expect(player1.hasStoodUp).toBe(false);

    // Player 2 should gain 50
    expect(player2.counter).toEqual(450);

    // Player 3 should gain 50
    expect(player3.counter).toEqual(350);
  });

  it('should reject sit down when player has insufficient counter', () => {
    const player1 = createPlayer('1', 80, true); // not enough for 2 * 50 = 100
    const player2 = createPlayer('2', 400);
    const player3 = createPlayer('3', 300);

    const roomInfo: IRoomInfo = {
      players: [player1, player2, player3],
      sit: [
        createSit(1, player2),
        createSit(2, player3),
      ],
      game: {} as any,
      sitLink: null,
      config: { isShort: false, smallBlind: 1 },
    };

    const result = applySeatChangePenalty(roomInfo, '1');

    expect(result.success).toBe(false);
    expect(result.totalPenalty).toEqual(100);
    expect(result.rejected).toBe(true);

    // No counter changes should occur
    expect(player1.counter).toEqual(80);
    expect(player2.counter).toEqual(400);
    expect(player3.counter).toEqual(300);
    expect(player1.hasStoodUp).toBe(true);
  });

  it('should not apply penalty when player has not stood up', () => {
    const player1 = createPlayer('1', 500, false); // hasStoodUp = false
    const player2 = createPlayer('2', 400);

    const roomInfo: IRoomInfo = {
      players: [player1, player2],
      sit: [createSit(1, player2)],
      game: {} as any,
      sitLink: null,
      config: { isShort: false, smallBlind: 1 },
    };

    const result = applySeatChangePenalty(roomInfo, '1');

    expect(result.success).toBe(true);
    expect(result.totalPenalty).toEqual(0);
    expect(player1.counter).toEqual(500);
    expect(player2.counter).toEqual(400);
  });

  it('should not apply penalty when no game is active', () => {
    const player1 = createPlayer('1', 500, true);
    const player2 = createPlayer('2', 400);

    const roomInfo: IRoomInfo = {
      players: [player1, player2],
      sit: [createSit(1, player2)],
      game: null, // no active game
      sitLink: null,
      config: { isShort: false, smallBlind: 1 },
    };

    const result = applySeatChangePenalty(roomInfo, '1');

    expect(result.success).toBe(true);
    expect(result.totalPenalty).toEqual(0);
    expect(player1.counter).toEqual(500);
    expect(player2.counter).toEqual(400);
  });

  it('should only count seated players with counter > 0 for penalty', () => {
    const player1 = createPlayer('1', 500, true);
    const player2 = createPlayer('2', 400);
    const player3 = createPlayer('3', 0); // counter = 0, should not count
    const player4 = createPlayer('4', 200);

    const roomInfo: IRoomInfo = {
      players: [player1, player2, player3, player4],
      sit: [
        createSit(1, player2),
        createSit(2, player3), // counter = 0
        createSit(3, player4),
      ],
      game: {} as any,
      sitLink: null,
      config: { isShort: false, smallBlind: 1 },
    };

    const result = applySeatChangePenalty(roomInfo, '1');

    expect(result.success).toBe(true);
    expect(result.totalPenalty).toEqual(100); // only 2 players (2 and 4) with counter > 0

    expect(player1.counter).toEqual(400);
    expect(player2.counter).toEqual(450);
    expect(player3.counter).toEqual(0); // unchanged
    expect(player4.counter).toEqual(250);
  });

  it('should reset hasStoodUp after successful penalty payment', () => {
    const player1 = createPlayer('1', 500, true);
    const player2 = createPlayer('2', 400);

    const roomInfo: IRoomInfo = {
      players: [player1, player2],
      sit: [createSit(1, player2)],
      game: {} as any,
      sitLink: null,
      config: { isShort: false, smallBlind: 1 },
    };

    applySeatChangePenalty(roomInfo, '1');

    expect(player1.hasStoodUp).toBe(false);
  });
});
