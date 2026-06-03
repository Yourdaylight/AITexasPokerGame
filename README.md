# AI Texas Poker Game 🃏

An online multiplayer Texas Hold'em game with **AI bot opponents powered by PokerSkill** — a 5-layer LLM-based strategy framework that enables frontier models to play expert-level poker without training or solvers.

> Based on research: *"PokerSkill: LLMs Can Play Expert-Level Poker without Training or Solvers"* (Li, Wang, Huang — Tsinghua University, 2026)

---

## Features

- 🎮 **Multiplayer Texas Hold'em** — Real-time gameplay via WebSocket (Socket.IO)
- 🤖 **AI Bot Players** — PokerSkill-powered bots that reason with structured 5-layer prompts
- 🔬 **A/B Comparison Toggle** — Enable/disable PokerSkill layers to compare against baseline prompts
- 🎨 **Vue 3 Frontend** — Card animations, action UI, VPIP/PFR stats display
- 🗄️ **SQLite Storage** — Lightweight local database, no external DB required for development
- 🐳 **Docker Deploy** — Production-ready with Nginx + Redis + multi-process support
- 🔐 **JWT Authentication** — Token-based auth with room-level access control

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────────────┐
│  Vue Client  │ ◄──────────────► │   Midway.js Server       │
│  (Vue 3 +    │   Socket.IO       │   (Egg.js + TypeScript)  │
│   TypeScript)│                   │                         │
└─────────────┘                   │  ┌───────────────────┐  │
                                  │  │   PokerGame Core   │  │
                                  │  │  (Rules / Actions) │  │
                                  │  └────────┬──────────┘  │
                                  │           │              │
                                  │  ┌────────▼──────────┐  │
                                  │  │   BotManager       │  │
                                  │  │  (Bot Lifecycle)   │  │
                                  │  └────────┬──────────┘  │
                                  │           │              │
                                  │  ┌────────▼──────────┐  │
                                  │  │   PokerSkillBot    │  │
                                  │  │  (5-Layer Prompt)  │  │
                                  │  └────────┬──────────┘  │
                                  │           │              │
                                  └───────────┼──────────────┘
                                              │
                                     ┌────────▼──────────┐
                                     │   LLM API          │
                                     │  (GPT / Claude)    │
                                     └───────────────────┘
```

### PokerSkill 5-Layer Architecture

| Layer | Scope | Content |
|-------|-------|---------|
| **P1** | Always | Game rules, execution framework, output format |
| **P2** | Preflop | GTO range guidance based on hand tier + position |
| **P3** | Postflop | Hand strength evaluation (pair detection, draws, pot odds) |
| **P4** | Postflop | Targeted strategy (ATT/DEF budget, viable options, c-bet sizing) |
| **P5** | River | Bluff/bluff-catch guidelines |

When `enablePokerSkill` is **off**, bots use a simple default prompt — enabling direct A/B comparison.

## Quick Start

### Prerequisites

- Node.js >= 18
- Yarn or npm
- Redis (for Socket.IO sticky sessions)
- SQLite (included via `sqlite3` npm package)

### Local Development

```bash
# 1. Clone
git clone https://github.com/Yourdaylight/AITexasPokerGame.git
cd AITexasPokerGame

# 2. Install server dependencies
cd server
yarn install

# 3. Start server (dev mode, port 5002)
yarn dev

# 4. In another terminal, start client
cd client
yarn install
yarn dev
```

The client dev server runs on `http://localhost:8080` by default.

### Quick Start (One Command)

```bash
bash start.sh
```

This starts both server and client using nvm to set Node.js 18.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_URL` | For AI bots | LLM API endpoint (e.g. `https://api.openai.com/v1/chat/completions`) |
| `LLM_API_KEY` | For AI bots | LLM API key |
| `LLM_MODEL` | For AI bots | Model name (default: `gpt-4o`) |
| `POKER_DB_PATH` | Optional | SQLite database path (default: `./poker.db`) |
| `PORT` | Optional | Server port (default: `7001`) |

### Docker Deploy

```bash
# Build and start all services
docker-compose -f docker/docker-compose.prod.yml build --no-cache
docker-compose -f docker/docker-compose.prod.yml up -d

# Build specific service
docker-compose -f docker/docker-compose.prod.yml build api --no-cache
```

## Enabling AI Bots

AI bots are controlled via the room configuration when joining a room. Pass these fields in `roomConfig`:

```json
{
  "enableBots": true,
  "botCount": 2,
  "enablePokerSkill": true,
  "botChips": 1000,
  "llmApiUrl": "https://api.openai.com/v1/chat/completions",
  "llmApiKey": "sk-...",
  "llmModel": "gpt-4o"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableBots` | boolean | `false` | Enable AI bot opponents |
| `botCount` | number | `1` | Number of bots to add |
| `enablePokerSkill` | boolean | `true` | Use 5-layer PokerSkill (false = baseline) |
| `botChips` | number | `1000` | Starting chips per bot |
| `llmApiUrl` | string | env | LLM API URL |
| `llmApiKey` | string | env | LLM API key |
| `llmModel` | string | `gpt-4o` | LLM model name |

### Toggle for A/B Comparison

Set `enablePokerSkill: false` to run the baseline mode (simple prompt, no skill layers). Compare bot win rates between the two modes to evaluate PokerSkill's effectiveness.

At runtime, you can toggle via:
```typescript
botManager.setPokerSkillEnabled(false); // disable skill layers
botManager.setPokerSkillEnabled(true);  // re-enable
```

## Project Structure

```
TexasPokerGame2/
├── client/                    # Vue 3 frontend
│   └── src/
│       ├── components/        # Vue components (Player, SitList, GameRecord...)
│       ├── utils/
│       │   ├── aiContext.ts   # Client-side AI advisor context management
│       │   └── PokerStyle.ts  # Hand strength evaluation
│       └── views/             # Page views (game, home, login...)
├── server/                    # Midway.js / Egg.js backend
│   └── src/
│       ├── app/
│       │   ├── core/
│       │   │   ├── PokerGame.ts      # Core game engine
│       │   │   ├── Player.ts         # Player state & actions
│       │   │   ├── Poker.ts          # Card deck & encoding
│       │   │   ├── PokerSkillBot.ts  # 🆕 5-layer AI strategy engine
│       │   │   └── BotManager.ts     # 🆕 Bot lifecycle management
│       │   ├── io/controller/
│       │   │   └── game.ts           # Game WebSocket controller
│       │   └── middleware/           # Auth, join, log middleware
│       ├── config/                   # Environment configs
│       ├── interface/                # TypeScript interfaces
│       ├── lib/                      # Base classes, SQLite DB
│       ├── service/                  # Data access layer
│       └── utils/                    # Linked list, constants
├── docker/                    # Docker Compose files
├── database/                  # SQL migration files
├── docs/                      # Documentation
├── CLAUDE.md                  # AI coding assistant guidelines
└── README.md
```

## Testing

```bash
cd server

# Run all tests
yarn test

# Run specific test
yarn test -- test/app/core/pokerGame.test.ts

# Coverage report
yarn cov
```

## Card Encoding

The project uses a 2-character encoding for cards:

| Character | Rank | Character | Suit |
|-----------|------|-----------|------|
| `a` | 2 | `1` | ♦ Diamond |
| `b` | 3 | `2` | ♣ Club |
| `c` | 4 | `3` | ♥ Heart |
| `d` | 5 | `4` | ♠ Spade |
| `e` | 6 | | |
| `f` | 7 | | |
| `g` | 8 | | |
| `h` | 9 | | |
| `i` | T (10) | | |
| `j` | J | | |
| `k` | Q | | |
| `l` | K | | |
| `m` | A | | |

Example: `m4` = A♠ (Ace of Spades), `a1` = 2♦ (Two of Diamonds)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Midway.js 3.x, Egg.js 2.x, TypeScript 4.8 |
| **Frontend** | Vue 3, Vue CLI, TypeScript |
| **Real-time** | Socket.IO (egg-socket.io) |
| **Database** | SQLite (via `sqlite3`), MySQL (optional) |
| **Cache** | Redis |
| **Auth** | JWT (egg-jwt) |
| **AI** | LLM API (OpenAI/Claude compatible) + PokerSkill |

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- PokerSkill framework based on research by Li, Wang & Huang (Tsinghua University, 2026)
- Original TexasPokerGame by [yujunhui](https://github.com/yujunhui/TexasPokerGame)
- Built with [Midway.js](https://midwayjs.org) and [Egg.js](https://eggjs.org)
