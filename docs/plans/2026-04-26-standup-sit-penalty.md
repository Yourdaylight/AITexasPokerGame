# Stand Up/Sit Down - Seat Change Penalty Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a player stands up during a game and sits back down (seat change), they must pay 50 points to every other seated player before being allowed to sit.

**Architecture:** Track "has stood up during current game" state on the server. When a player tries to sit down, the server validates whether a penalty applies. If it does, the server deducts 50 points per other seated player from the re-sitting player's counter and adds 50 to each other player's counter. The client shows a confirmation dialog before proceeding.

**Tech Stack:** Node.js/TypeScript (Midway + egg-socket.io), Vue 2 + TypeScript (client)

---

### Task 1: Add `hasStoodUp` field to IPlayer interface (server)

**Files:**
- Modify: `server/src/app/core/Player.ts:3-31` (IPlayer interface)
- Modify: `server/src/interface/IGameRoom.ts` (no change needed, ISit uses IPlayer)

**Step 1: Add `hasStoodUp` field to IPlayer interface**

In `server/src/app/core/Player.ts`, add the field to the `IPlayer` interface:

```typescript
export interface IPlayer {
  // ... existing fields ...
  /** 本局游戏中是否站起过（用于换座惩罚判定） */
  hasStoodUp: boolean;
}
```

**Step 2: Initialize `hasStoodUp` in join middleware**

In `server/src/app/io/middleware/join.ts`, when creating a new player object, add:

```typescript
hasStoodUp: false,
```

**Step 3: Reset `hasStoodUp` when a new game starts**

In `server/src/app/io/controller/game.ts`, in the `reStart()` method, add reset in the `roomInfo.players.forEach` block and also in the `playGame()` method where players are initialized for a new game:

```typescript
p.hasStoodUp = false;
```

**Step 4: Commit**

```bash
git add server/src/app/core/Player.ts server/src/app/io/middleware/join.ts server/src/app/io/controller/game.ts
git commit -m "feat: add hasStoodUp field to IPlayer for seat-change penalty tracking"
```

---

### Task 2: Set `hasStoodUp = true` when player stands up during a game

**Files:**
- Modify: `server/src/app/io/controller/game.ts:443-457` (standUp method)

**Step 1: Update the standUp handler**

Modify the `standUp()` method in `game.ts` to set `hasStoodUp = true` when the player stands up during an active game:

```typescript
async standUp() {
  try {
    console.log('stand up');
    const userInfo: IPlayer = await this.getUserInfo();
    const roomInfo = await this.getRoomInfo();
    const isGaming = !!roomInfo.game;
    roomInfo.sit.forEach((s: ISit) => {
      if (s.player && s.player.userId === userInfo.userId) {
        delete s.player;
      }
    });
    // Mark player as having stood up during a game (for seat-change penalty)
    if (isGaming) {
      const player = roomInfo.players.find((p: IPlayer) => p.userId === userInfo.userId);
      if (player) {
        player.hasStoodUp = true;
      }
    }
    await this.updateGameInfo();
  } catch (e) {
    console.log(e);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/app/io/controller/game.ts
git commit -m "feat: set hasStoodUp=true when player stands up during game"
```

---

### Task 3: Add `SitDownPenalty` OnlineAction constant

**Files:**
- Modify: `server/src/utils/constant.ts:9-25` (OnlineAction enum)
- Modify: `client/src/utils/constant.ts` (client-side OnlineAction enum)

**Step 1: Add to server OnlineAction enum**

In `server/src/utils/constant.ts`, add to the `OnlineAction` enum:

```typescript
/** 换座坐下惩罚通知 */
SitDownPenalty = 'sitDownPenalty',
```

**Step 2: Add to client OnlineAction enum**

In `client/src/utils/constant.ts`, add the same enum value to the client-side `OnlineAction` enum.

**Step 3: Commit**

```bash
git add server/src/utils/constant.ts client/src/utils/constant.ts
git commit -m "feat: add SitDownPenalty OnlineAction constant"
```

---

### Task 4: Server-side sit down validation and penalty deduction

**Files:**
- Modify: `server/src/app/io/controller/game.ts:427-441` (sitDown method)

**Step 1: Rewrite sitDown to validate penalty and distribute points**

Replace the current `sitDown()` method with logic that:
1. Checks if the player has `hasStoodUp === true` and a game is in progress
2. If yes, calculates the penalty (50 per other seated player with counter > 0)
3. Checks if the player has enough counter to pay
4. Deducts from the sitting player and adds to each other player
5. Broadcasts updated state

```typescript
async sitDown() {
  try {
    const { payload } = this.message;
    const sitList = payload.sitList;
    const userInfo: IPlayer = await this.getUserInfo();
    const roomInfo = await this.getRoomInfo();

    // Check for seat-change penalty during an active game
    if (roomInfo.game) {
      const player = roomInfo.players.find((p: IPlayer) => p.userId === userInfo.userId);
      if (player && player.hasStoodUp) {
        // Count other seated players with chips
        const otherSeatedPlayers = roomInfo.sit.filter(
          (s) => s.player && s.player.userId !== userInfo.userId && s.player.counter > 0
        );
        const penaltyPerPlayer = 50;
        const totalPenalty = otherSeatedPlayers.length * penaltyPerPlayer;

        if (player.counter < totalPenalty) {
          // Not enough chips to pay penalty - reject sit down
          this.adapter(Online, OnlineAction.SitDownPenalty, {
            userId: userInfo.userId,
            penaltyRequired: totalPenalty,
            playerCounter: player.counter,
            rejected: true,
          });
          return;
        }

        // Deduct penalty from the re-sitting player
        player.counter -= totalPenalty;

        // Distribute 50 to each other seated player
        otherSeatedPlayers.forEach((s) => {
          s.player!.counter += penaltyPerPlayer;
          // Also update in roomInfo.players
          const p = roomInfo.players.find((rp) => rp.userId === s.player!.userId);
          if (p) {
            p.counter += penaltyPerPlayer;
          }
        });

        // Clear the stood-up flag
        player.hasStoodUp = false;

        // Notify all players about the penalty
        this.adapter(Online, OnlineAction.SitDownPenalty, {
          userId: userInfo.userId,
          nickName: userInfo.nickName,
          penaltyPerPlayer,
          totalPenalty,
          recipientCount: otherSeatedPlayers.length,
          rejected: false,
        });
      }
    }

    roomInfo.sit = sitList;
    this.adapter(Online, OnlineAction.SitList, {
      sitList,
    });
  } catch (e) {
    console.log(e);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/app/io/controller/game.ts
git commit -m "feat: server-side seat-change penalty - deduct 50 per player on sit down"
```

---

### Task 5: Include `hasStoodUp` in updateGameInfo broadcasts

**Files:**
- Modify: `server/src/lib/baseSocketController.ts:103-128` (gameInfo object in updateGameInfo)

**Step 1: Add hasStoodUp to the gameInfo payload**

In the `gameInfo` object built inside `updateGameInfo()`, add `hasStoodUp` to each player mapping:

```typescript
hasStoodUp: p.hasStoodUp || false,
```

This ensures the client knows whether the current player has stood up during this game.

**Step 2: Commit**

```bash
git add server/src/lib/baseSocketController.ts
git commit -m "feat: include hasStoodUp in gameInfo broadcast"
```

---

### Task 6: Add `hasStoodUp` to client-side IPlayer interface

**Files:**
- Modify: `client/src/interface/IPlayer.ts:7-27`

**Step 1: Add field**

```typescript
/** 本局游戏中是否站起过 */
hasStoodUp: boolean;
```

**Step 2: Commit**

```bash
git add client/src/interface/IPlayer.ts
git commit -m "feat: add hasStoodUp to client IPlayer interface"
```

---

### Task 7: Client-side - show penalty confirmation before sit down

**Files:**
- Modify: `client/src/components/SitList.vue:216-246` (sitDown method)
- Modify: `client/src/views/game.vue` (socket listener for SitDownPenalty)

**Step 1: Update SitList.vue sitDown method to check penalty**

When the game is in progress and the current player `hasStoodUp === true`, show a confirmation dialog before allowing the sit-down. The client already knows from the game state that the player stood up.

In `SitList.vue`, modify the `sitDown` method:

```typescript
public sitDown(sit: ISit) {
  if (!sit.player && (!this.isPlay || !this.hasSit)) {
    if (this.currPlayer.counter <= 0) {
      this.showBuyIn = true;
      this.currSit = sit;
      return;
    }
    // Check if player stood up during this game (seat-change penalty)
    if (this.currPlayer.hasStoodUp && this.isPlay) {
      const otherSeatedCount = this.sitList.filter(
        (s) => s.player && s.player.userId !== this.currPlayer?.userId && s.player.counter > 0
      ).length;
      const totalPenalty = otherSeatedCount * 50;
      if (this.currPlayer.counter < totalPenalty) {
        this.$emit('toast', `积分不足！换座需要支付 ${totalPenalty} 积分（${otherSeatedCount}人 x 50）`);
        return;
      }
      const confirmed = confirm(`换座需要向其他${otherSeatedCount}位玩家各支付50积分（共${totalPenalty}积分），确认坐下？`);
      if (!confirmed) {
        return;
      }
    }
    // ... rest of existing sitDown logic (unchanged)
  }
}
```

**Step 2: Add SitDownPenalty listener in game.vue**

In `game.vue`, in the `socketInit()` method, add a listener for the `SitDownPenalty` action inside the `Online` socket event handler:

```typescript
if (msg.action === OnlineAction.SitDownPenalty) {
  const data = msg.data;
  if (data.rejected) {
    if (data.userId === this.userInfo.userId) {
      this.$plugin.toast(`积分不足！换座需要 ${data.penaltyRequired} 积分`);
    }
  } else {
    // Show notification that player changed seat with penalty
    this.$plugin.toast(`${data.nickName} 换座支付了 ${data.totalPenalty} 积分（${data.recipientCount}人 x ${data.penaltyPerPlayer}）`);
  }
}
```

Also add a `@toast` event handler from SitList:

In the template where `<sitList>` is used, add `@toast="showToast"` and implement:

```typescript
public showToast(message: string) {
  this.msg = message;
  this.showMsg = true;
}
```

**Step 3: Commit**

```bash
git add client/src/components/SitList.vue client/src/views/game.vue
git commit -m "feat: client-side seat-change penalty confirmation and notification"
```

---

### Task 8: Add OnlineAction.SitDownPenalty to client constants

**Files:**
- Modify: `client/src/utils/constant.ts`

**Step 1: Add enum value**

In the client-side `OnlineAction` enum, add:

```typescript
SitDownPenalty = 'sitDownPenalty',
```

**Step 2: Commit**

```bash
git add client/src/utils/constant.ts
git commit -m "feat: add SitDownPenalty to client OnlineAction enum"
```

---

### Task 9: Reset hasStoodUp at game boundaries

**Files:**
- Modify: `server/src/app/io/controller/game.ts` (reStart method, playGame method)

**Step 1: In reStart(), reset hasStoodUp for all players**

In the `reStart()` method, inside the `roomInfo.players.forEach((p) => { ... })` block, add:

```typescript
p.hasStoodUp = false;
```

**Step 2: In the gameOver callback in playGame(), also reset hasStoodUp**

When syncing player data at game over, ensure `hasStoodUp` is reset:

```typescript
player.hasStoodUp = false;
```

**Step 3: Commit**

```bash
git add server/src/app/io/controller/game.ts
git commit -m "feat: reset hasStoodUp at game start/end boundaries"
```

---

### Task 10: Manual integration test

**Step 1: Start the server**

```bash
cd /home/lzh/jqyl/TexasPokerGame2/server && npm run dev
```

**Step 2: Start the client**

```bash
cd /home/lzh/jqyl/TexasPokerGame2/client && npm run serve
```

**Step 3: Test scenario**

1. Open 3 browser tabs, join the same room with 3 users
2. All 3 users buy in and sit down
3. Start a game
4. User A folds their hand, then stands up
5. User A clicks an empty seat to sit down
6. Verify: confirmation dialog appears showing penalty amount (2 players x 50 = 100)
7. Confirm the sit-down
8. Verify: User A's counter decreased by 100, User B and C each gained 50
9. Verify: A toast notification appears for all users about the penalty
10. Test rejection: User A stands up again, but this time their counter is less than 100 - verify they get a "not enough points" message

**Step 4: Commit final state if any fixes needed**

```bash
git add -A
git commit -m "fix: integration test fixes for seat-change penalty feature"
```
