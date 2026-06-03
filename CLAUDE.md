# CLAUDE.md — AI Texas Poker Game

> Guidelines for AI coding assistants (Claude, Codex, etc.) working on this project.
> Violating the **Security Red Lines** section is a blocker — PRs will be rejected.

---

## Project Overview

An online multiplayer Texas Hold'em game with LLM-powered AI opponents. The server is a Midway.js (Egg.js) TypeScript application using Socket.IO for real-time communication and SQLite for storage. The client is Vue 3 with TypeScript.

**Key architectural decisions:**
- No IPC between workers — `workers=1` with `--sticky` session affinity
- Game state lives in-memory on the Socket.IO namespace (`nsp.gameRooms`)
- Room config includes bot settings that propagate through the game lifecycle
- Bot actions chain automatically (800ms delay between consecutive bots)
- PokerSkillBot's `enableSkills` flag is the single source of truth for A/B testing

---

## Development Standards

### Code Style

- **TypeScript strictness**: Use explicit types. Avoid `any` except at module boundaries (e.g., `getBotAction` parameter is `any` because `Player` class differs from `IPlayer` interface).
- **Naming**: PascalCase for classes/enums, camelCase for methods/variables, UPPER_SNAKE for constants.
- **File organization**: Core game logic in `server/src/app/core/`, controllers in `server/src/app/io/controller/`, interfaces in `server/src/interface/`.
- **Imports**: Absolute imports from project root are preferred over deep relative paths.
- **No prettier config** — the project uses `tslint` with `eslint-config-egg`.

### PokerSkillBot Patterns

When modifying AI bot behavior, follow the established patterns:

1. **5-layer separation**: Each layer (P1-P5) is a standalone function returning a string. Never mix layer logic.
2. **Deterministic engine**: The context engine should always be deterministic — same state → same prompt. No randomness in prompt building.
3. **LLM call**: Isolated in `callLLM()`. Wrap in try/catch with fallback to `simpleBotAction()`.
4. **Action parsing**: `parseAction()` is defensive — tries JSON first, then regex, then fallback to `fold`.
5. **Toggle state**: Read from `this.config.enableSkills`. The `BotManager.setPokerSkillEnabled()` updates it at runtime.

### BotManager Patterns

- Bots are identified by `userId` starting with `bot_`.
- Bot players are added to both `roomInfo.players` and `sitDownPlayer`.
- `actionQueue` prevents duplicate LLM calls for the same bot.
- Bot chain (consecutive bots) has a hard limit of 10 to prevent infinite loops.

### Game Controller Patterns

- `triggerBotActionIfNeeded()` is the entry point for the bot action chain. It's called from:
  - `action()` — after a human action completes
  - `autoActionCallBack` — when a bot timeout fires (intercepted before fold)
  - `playGame()` — when the first player is a bot
- Bot actions go through the same `roomInfo.game.action()` path as human actions.
- `updateGameInfo()` must be called after every bot action to broadcast state.

---

## Testing Standards

### What to Test

- **Game logic**: Card dealing, hand evaluation, action validation, pot calculation (see `pokerGame.test.ts`)
- **PokerSkillBot**: Prompt building with various game states, action parsing from LLM responses, fallback behavior
- **BotManager**: Bot creation, state building, action queue deduplication

### What NOT to Test

- Socket.IO message routing (integration tested manually)
- LLM API calls (mock the `fetch` call or use a fake LLM)
- Vue component rendering (covered by manual QA)

### Test Commands

```bash
cd server
yarn test                          # All tests (lint + jest)
yarn test -- --testPathPattern=pokerGame    # Specific test file
yarn cov                           # Coverage report
```

### Writing Tests

- Use Jest (`ts-jest`). Tests go in `server/test/` mirroring `server/src/`.
- Mock external dependencies (LLM API, database) — tests should be fast and deterministic.
- For `PokerSkillBot`, test `buildPrompt()` output against known game states.
- For `BotManager`, test `buildGameState()` with mock `PokerGame` instances.

---

## Deployment Standards

### Local Development

```bash
# Server (port 5002)
cd server && yarn dev

# Client (port 8080)
cd client && yarn dev
```

### Production

```bash
# Build and deploy
cd server && yarn build && yarn start

# Or via Docker
docker-compose -f docker/docker-compose.prod.yml up -d
```

### Pre-deploy Checklist

- [ ] All tests pass: `yarn test`
- [ ] TypeScript compiles without errors
- [ ] Environment variables set: `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` (if using bots)
- [ ] Redis is running (for Socket.IO sticky sessions)
- [ ] `workers=1 --sticky` is in the start command (no IPC between workers)
- [ ] Database schema matches `database/poker.sql`
- [ ] No hardcoded secrets in code (use env vars or config)

### Multi-process Notes

For production with multiple CPU cores:
- Keep `--workers=1 --sticky`
- Run multiple instances on different ports (7000-7010)
- Route clients to specific instances based on `roomNumber` first digit
- Only port 7000 handles REST API; 7001+ handle Socket.IO

---

## PokerSkill A/B Testing Protocol

When comparing `enablePokerSkill: true` vs `false`:

1. **Isolation**: Run each mode with identical bot count, model, temperature, starting chips
2. **Sample size**: Minimum 500 hands per mode for statistical significance
3. **Metrics**: Track BB/hand, VPIP, PFR, aggression frequency, showdown win rate
4. **Controls**: Same LLM model and temperature for both modes
5. **No crossover**: Don't mix enabled/disabled bots in the same session

To switch modes mid-session:
```typescript
const botManager = roomInfo.botManager;
botManager?.setPokerSkillEnabled(true);  // or false
```

---

## Security Red Lines 🚨

### DO NOT:

1. **NEVER hardcode API keys or secrets in source code.**
   - Use environment variables: `LLM_API_KEY`, `LLM_API_URL`
   - Config files (`config.default.ts`) should reference `process.env.*`, not contain real keys.
   - ❌ `apiKey: 'sk-abc123...'`
   - ✅ `apiKey: process.env.LLM_API_KEY`

2. **NEVER log hand cards, tokens, or API keys.**
   - The `cardsLogger` is already isolated in `cards.log` — keep it that way.
   - LLM prompts and responses must NOT be logged at INFO level — use DEBUG only.
   - Bot action history (`getHistory()`) should not be exposed to API responses.
   - ❌ `console.log('LLM response:', fullResponse)`
   - ✅ `console.log('LLM response:', fullResponse.slice(0, 50))`

3. **NEVER expose internal game state to clients.**
   - Only send what the player should see (their own cards, public cards, visible actions).
   - `getHandCard()` is already only sent to the card owner — do not break this.
   - Bot hand cards must not leak through `GameOver` broadcasts (the `handCard: []` reset in winner display is intentional).

4. **NEVER execute untrusted code or prompts from clients.**
   - Player-set agent prompts go through `aiContext.ts` sanitization (`sanitizeUserPrompt`, `sanitizeMessages`).
   - Bot prompt building uses ONLY server-controlled logic (P1-P5 layers) — never inject raw user input.
   - The LLM response `parseAction()` must validate output format — never `eval()` or directly execute LLM output.

5. **NEVER allow bots to make real-money decisions.**
   - This is a game for entertainment and research.
   - Bot chip values are virtual — make this clear in the UI.
   - No integration with real payment systems for bot accounts.

6. **NEVER skip the LLM timeout/fallback.**
   - `callLLM()` has a 15-second AbortController timeout.
   - Fallback `simpleBotAction()` must always be reachable.
   - Without fallback, a stuck LLM call blocks the entire game for all players.

### Security Checklist for PR Review

- [ ] No hardcoded API keys
- [ ] No sensitive data in log statements
- [ ] Player hand cards not leaked to other clients
- [ ] Bot prompts use server-side logic only
- [ ] LLM responses validated before execution
- [ ] Timeout/fallback always present for external API calls

---

## Common Pitfalls

### TypeScript + Egg.js

- `ctx` property may show as non-existent on controllers — this is a pre-existing LSP issue with Egg.js base classes. Do not "fix" by adding explicit type declarations that break the egg decorator pattern.
- `module.exports` pattern is required for Egg.js loader compatibility — do not convert to ES6 `export default`.
- The `Player` class and `IPlayer` interface are intentionally separate (Player is the game engine's mutable object, IPlayer is the wire format).

### Bot Integration

- Bot `userId` format is `bot_<timestamp>_<index>_<random>` — do not change this format as it's how `isBot()` identifies bots.
- `actionQueue` is critical to prevent duplicate LLM calls — ensure it's always cleaned up in `finally` block of `getBotAction()`.
- Bot chain `maxChain = 10` is a safety limit — if you hit it, bots are probably in a loop, not a legitimate chain.

### Game Logic

- `startActionRound()` timeout auto-folds after 45s — this is overwritten for bots by `autoActionCallBack`.
- `reStart()` resets all player status — bots must be re-added from `botManager.getBots()`.
- All-in players are moved from `playerLink` to `allInPlayers` array — side pots are calculated in `actionComplete()`.
