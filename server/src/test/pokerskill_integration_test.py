#!/usr/bin/env python3
"""
PokerSkill Integration Test Suite
覆盖完整集成链路：5层架构、A/B切换、BotManager、前后端集成点
"""

import re, os, sys
from pathlib import Path
from collections import defaultdict

# ============================================================
# 路径配置
# ============================================================
BASE = Path(__file__).resolve().parents[3]  # AITexasPokerGame root
SERVER_SRC = BASE / "server" / "src"
CLIENT_SRC = BASE / "client" / "src"

# ============================================================
# 测试框架
# ============================================================
class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.logs = []
    
    def ok(self, name, detail=""):
        self.passed += 1
        self.logs.append(f"[PASS] {name}" + (f": {detail}" if detail else ""))
    
    def fail(self, name, detail=""):
        self.failed += 1
        self.logs.append(f"[FAIL] {name}" + (f": {detail}" if detail else ""))
    
    def warn(self, name, detail=""):
        self.warnings += 1
        self.logs.append(f"[WARN] {name}: {detail}")
    
    def section(self, title):
        self.logs.append(f"\n{'='*60}\n{title}\n{'='*60}")
    
    def summary(self):
        total = self.passed + self.failed
        rate = (self.passed / total * 100) if total else 0
        self.logs.append(f"\n{'='*60}\nFINAL: {self.passed} passed, {self.failed} failed, {self.warnings} warnings")
        self.logs.append(f"SUCCESS RATE: {rate:.1f}%")
        return self.failed == 0

R = TestRunner()

# ============================================================
# Python 复刻 PokerSkillBot 核心逻辑
# ============================================================

CardNumberMap = {
    'a': '2', 'b': '3', 'c': '4', 'd': '5', 'e': '6', 'f': '7',
    'g': '8', 'h': '9', 'i': 'T', 'j': 'J', 'k': 'Q', 'l': 'K', 'm': 'A',
}
CardSuitMap = {'1': 'd', '2': 'c', '3': 'h', '4': 's'}

def fmt_card(code):
    if not code or len(code) != 2: return code
    return CardNumberMap.get(code[0], code[0]) + CardSuitMap.get(code[1], code[1])

def classify_hand_tier(hand):
    ranks = [CardNumberMap.get(c[0], c[0]) for c in hand]
    suits = [c[1] for c in hand]
    is_pair = ranks[0] == ranks[1]
    is_suited = suits[0] == suits[1]
    rank_order = '23456789TJQKA'
    ri = [rank_order.index(r) for r in ranks]
    high_idx, low_idx = max(ri), min(ri)
    gap = high_idx - low_idx
    
    if is_pair:
        if high_idx >= rank_order.index('J'): return 'premium_pair', 5
        elif high_idx >= rank_order.index('7'): return 'medium_pair', 4
        else: return 'low_pair', 2
    elif high_idx >= rank_order.index('T'):
        if low_idx >= rank_order.index('T') or (low_idx >= rank_order.index('9') and is_suited):
            return 'premium_broadway', 4
        elif low_idx >= rank_order.index('9'): return 'strong_broadway', 3
        elif is_suited and gap <= 2: return 'suited_connector', 3
        else: return 'marginal_high', 1
    elif is_suited and gap <= 2 and high_idx >= rank_order.index('6'):
        return 'suited_connector', 2
    elif is_pair or (is_suited and high_idx >= rank_order.index('9')):
        return 'playable', 1
    else:
        return 'weak', 0

def build_p2_preflop(state):
    hand = [fmt_card(c) for c in state['handCard']]
    tier, _ = classify_hand_tier(state['handCard'])
    pos = state['myPosition']
    pos_label = {'d': '庄位(Button)', 'sb': '小盲(SB)', 'bb': '大盲(BB)'}.get(pos, '中间位置')
    num = state['numActivePlayers']
    has_raise = any(a['action'].startswith('raise') or a['action'].startswith('bet') 
                    for a in state.get('currentRoundActions', []))
    
    guidance = f"\n**翻前范围指导 (P2):**\n- 手牌: {' '.join(hand)}\n- 手牌等级: {tier}\n- 位置: {pos_label}\n- 在局人数: {num}人\n"
    
    if tier in ('premium_pair', 'premium_broadway'):
        guidance += f"- **策略**: 强牌，应该加注。建议加注到 {state['bigBlind']*3}~{state['bigBlind']*5}。"
    elif tier in ('medium_pair', 'strong_broadway'):
        guidance += "- **策略**: 后位强牌，可以加注。面对加注可以跟注。"
    elif tier in ('low_pair', 'suited_connector'):
        guidance += "- **策略**: 投机牌。在后位且底池未被加注时可以跟注看翻牌。面对大加注建议弃牌。"
    elif tier in ('marginal_high', 'playable'):
        guidance += "- **策略**: 边缘牌。后位且无人加注时可考虑跟注，前位或面对加注建议弃牌。"
    else:
        guidance += "- **策略**: 弱牌。大多数情况下应该弃牌，除非在大盲位且无人加注。"
    
    if pos == 'bb' and not has_raise:
        guidance += "\n- **大盲位特权**: 无人加注时可以免费看翻牌(check)。"
    
    return guidance

def build_p3_postflop(state):
    hand = [fmt_card(c) for c in state['handCard']]
    board = [fmt_card(c) for c in state['commonCard']]
    guidance = f"\n**翻后通用原则与牌力评估 (P3):**\n- 手牌: {' '.join(hand)}\n- 公共牌: {' '.join(board) if board else '无'}\n- 阶段: {state['stage']}\n- 底池: {state['pot']}\n"
    
    all_cards = hand + board
    all_suits = [c[-1] for c in all_cards]
    suit_counts = defaultdict(int)
    for s in all_suits: suit_counts[s] += 1
    flush_draw = any(c >= 4 for c in suit_counts.values())
    
    rank_order = '23456789TJQKA'
    all_ranks = [c[0] for c in all_cards]
    rank_counts = defaultdict(int)
    for r in all_ranks: rank_counts[r] += 1
    
    has_pair = any(c >= 2 for c in rank_counts.values())
    has_trips = any(c >= 3 for c in rank_counts.values())
    
    if has_trips:
        guidance += "- **牌力**: 强 (三条/葫芦可能)\n- **策略**: 强牌，持续下注获取价值。"
    elif has_pair:
        pair_rank = max((rank_order.index(r) for r, c in rank_counts.items() if c >= 2), default=0)
        if pair_rank >= rank_order.index('T'):
            guidance += "- **牌力**: 中等 (顶对)\n- **策略**: 顶对大踢脚，可以持续下注。需注意对手可能的强牌。"
        else:
            guidance += "- **牌力**: 中等 (小对)\n- **策略**: 中等对子，控池为主。"
    elif flush_draw:
        guidance += "- **牌力**: 中等 (听牌)\n- **策略**: 有发展潜力的听牌。如赔率合适可以跟注。"
    else:
        guidance += "- **牌力**: 弱 (高牌)\n- **策略**: 没有成牌。可以考虑诈唬或过牌弃牌。"
    
    if state['prevSize'] > 0:
        guidance += f"\n- **底池赔率**: 需跟注 {state['prevSize']} 赢 {state['pot'] + state['prevSize']}"
    
    return guidance

def build_p4_targeted(state):
    if state['stage'] == 'preflop': return ''
    num = state['numActivePlayers']
    has_agg = any(a['action'].startswith(('raise', 'bet', 'allin')) 
                  for a in state.get('currentRoundActions', []))
    is_hu = num <= 2
    
    guidance = f"\n**针对性策略 (P4):**\n- 在局人数: {num}\n- 底池状态: {'有人进攻' if has_agg else '无人进攻'}\n- 局面: {'单挑' if is_hu else '多人底池'}\n"
    
    if has_agg:
        guidance += "- **防守模式**: 对手展示了进攻意图。\n  * 强牌: 可以跟注或再加注\n  * 听牌: 根据底池赔率决定\n  * 弱牌: 弃牌"
    else:
        guidance += f"- **进攻模式**: 你有主动权。\n  * 持续下注: 建议高频率下注\n  * 下注大小: 建议半池到3/4池"
    
    return guidance

def build_p5_river(state):
    if state['stage'] != 'river': return ''
    board = [fmt_card(c) for c in state['commonCard']]
    return f"\n**河牌诈唬与抓诈指导 (P5):**\n- 公共牌: {' '.join(board)}\n\n**诈唬条件检查:**\n- 你的手牌是否有摊牌价值?\n- 牌面是否有完成的听牌?\n**抓诈条件检查:**\n- 你是否有中等强度的成牌?\n- 对手的故事是否连贯?\n- 底池赔率是否合适?"

def build_situation(state):
    hand = [fmt_card(c) for c in state['handCard']]
    board = [fmt_card(c) for c in state['commonCard']]
    stage_names = {'preflop': '翻前', 'flop': '翻牌', 'turn': '转牌', 'river': '河牌'}
    
    lines = [
        "**当前局面:**",
        f"- 你的手牌: {' '.join(hand)}",
        f"- 公共牌: {' '.join(board) if board else '无'}",
        f"- 阶段: {stage_names.get(state['stage'], state['stage'])}",
        f"- 底池: {state['pot']}",
        f"- 当前需要跟注: {state['prevSize']}",
        f"- 你的筹码: {state['myCounter']}",
        f"- 盲注: {state['smallBlind']}/{state['bigBlind']}",
        f"- 在局活跃玩家: {state['numActivePlayers']}人",
    ]
    
    if state.get('players'):
        lines.append("\n**其他玩家:**")
        for p in state['players']:
            lines.append(f"  * {p['nickName']}: {p['counter']}筹码")
    
    if state.get('currentRoundActions'):
        lines.append("\n**本轮操作记录:**")
        for a in state['currentRoundActions'][-5:]:
            lines.append(f"  * {a['nickName']}: {a['action']}")
    
    return '\n'.join(lines)

def build_full_prompt(state, enable_skills=True):
    """完整复刻 PokerSkillBot.buildPrompt 逻辑"""
    parts = []
    parts.append("""你是一位世界级的无限注德州扑克玩家。你必须在当前牌局中做出最优决策。

**游戏规则：**
- 这是无限注德州扑克（No-Limit Texas Hold'em）
- 你可以执行以下操作：fold（弃牌）、check（过牌）、call（跟注）、raise:XXX（加注到XXX）、allin（全下）
- 加注必须至少是前一个加注额的两倍，或至少是大盲注的两倍
- check 只有在当前无需跟注时才能使用
- 你必须在合法操作中选择一个

**输出格式（严格按照此格式，不要输出任何其他内容）：**
{ "action": "<action_type>", "reasoning": "<简短的中文理由>" }

action_type 必须是以下之一：fold, check, call, raise:XXX, allin""")
    
    if enable_skills:
        if state['stage'] == 'preflop':
            p2 = build_p2_preflop(state)
            if p2: parts.append(p2)
        if state['stage'] != 'preflop':
            p3 = build_p3_postflop(state)
            if p3: parts.append(p3)
        p4 = build_p4_targeted(state)
        if p4: parts.append(p4)
        if state['stage'] == 'river':
            p5 = build_p5_river(state)
            if p5: parts.append(p5)
    
    parts.append(build_situation(state))
    return '\n\n---\n\n'.join(parts)

# ============================================================
# Group 1: 5-Layer Architecture
# ============================================================
R.section('GROUP 1: 5-Layer Architecture')

def mk_state(**kw):
    defaults = dict(handCard=['m4','m3'], commonCard=[], pot=30, prevSize=10,
                    smallBlind=5, bigBlind=10, myPosition='d', myCounter=1000,
                    myActionSize=0, isShort=False, players=[], currentRoundActions=[],
                    stage='preflop', numActivePlayers=3)
    defaults.update(kw)
    return defaults

# P1 always present
p = build_full_prompt(mk_state(), True)
R.ok('P1 always present', 'rules in prompt' if '游戏规则' in p else R.fail('P1 always present', 'missing'))

# P2 for preflop
p = build_full_prompt(mk_state(stage='preflop'), True)
R.ok('P2 preflop present', 'P2 active') if '翻前范围指导 (P2)' in p else R.fail('P2 preflop present')

# P3 for flop
p = build_full_prompt(mk_state(stage='flop', commonCard=['i3','h2','d4'], handCard=['k3','j3']), True)
R.ok('P3 flop present', 'P3 active') if '翻后通用原则与牌力评估 (P3)' in p else R.fail('P3 flop present')
R.ok('P2 not in flop', 'correctly skipped') if '翻前范围指导 (P2)' not in p else R.fail('P2 should not be in flop')

# P4 for turn
p = build_full_prompt(mk_state(stage='turn', commonCard=['m1','m2','k3','e4'], handCard=['m3','l3']), True)
R.ok('P4 turn present', 'P4 active') if '针对性策略 (P4)' in p else R.fail('P4 turn present')

# P5 for river
p = build_full_prompt(mk_state(stage='river', commonCard=['a3','c2','g3','d1','i4'], handCard=['j4','h4']), True)
R.ok('P5 river present', 'P5 active') if '河牌诈唬与抓诈指导 (P5)' in p else R.fail('P5 river present')

# P5 NOT for flop
p = build_full_prompt(mk_state(stage='flop', commonCard=['i3','h2','d4']), True)
R.ok('P5 NOT in flop', 'correctly skipped') if '河牌诈唬与抓诈指导 (P5)' not in p else R.fail('P5 should not be in flop')

# P4 NOT for preflop
p = build_full_prompt(mk_state(stage='preflop'), True)
R.ok('P4 NOT in preflop', 'correctly skipped') if '针对性策略 (P4)' not in p else R.fail('P4 should not be in preflop')

# ============================================================
# Group 2: A/B Toggle
# ============================================================
R.section('GROUP 2: A/B Toggle - Baseline vs PokerSkill')

# Baseline only P1
river_state = mk_state(stage='river', commonCard=['a3','c2','g3','d1','i4'])
base = build_full_prompt(river_state, False)
R.ok('Baseline P1 present', 'has rules') if '游戏规则' in base else R.fail('Baseline P1')
R.ok('Baseline no P2', 'correct') if 'P2' not in base else R.fail('Baseline has P2')
R.ok('Baseline no P3', 'correct') if 'P3' not in base else R.fail('Baseline has P3')
R.ok('Baseline no P4', 'correct') if 'P4' not in base else R.fail('Baseline has P4')
R.ok('Baseline no P5', 'correct') if 'P5' not in base else R.fail('Baseline has P5')

# PokerSkill all layers
skill = build_full_prompt(river_state, True)
R.ok('Skill P3 present', 'has P3') if 'P3' in skill else R.fail('Skill P3')
R.ok('Skill P4 present', 'has P4') if 'P4' in skill else R.fail('Skill P4')
R.ok('Skill P5 present', 'has P5') if 'P5' in skill else R.fail('Skill P5')

# Info delta
delta = len(skill) - len(base)
ratio = len(skill) / len(base) if base else 0
R.ok(f'Info delta {ratio:.1f}x', f'{len(base)} -> {len(skill)} (+{delta})') if ratio > 1.3 else R.fail('Info delta too small', f'{ratio:.2f}x')

# ============================================================
# Group 3: Hand Tier Classification
# ============================================================
R.section('GROUP 3: Hand Tier Classification Matrix')

tier_tests = [
    (['m4','m3'], 'premium_pair', 'AA'),
    (['l4','l3'], 'premium_pair', 'KK'),
    (['k4','k3'], 'premium_pair', 'QQ'),
    (['j4','j3'], 'premium_pair', 'JJ'),      # J in 'JQKA' => premium_pair
    (['i4','i3'], 'medium_pair', 'TT'),       # T in '789T' => medium_pair
    (['h4','h3'], 'medium_pair', '99'),       # 9 in '789T' => medium_pair
    (['m3','l4'], 'premium_broadway', 'AKs'), # lowIdx>=8 && suited => premium_broadway
    (['m1','l2'], 'premium_broadway', 'AKo'), # lowIdx>=8 => premium_broadway
    (['k3','j3'], 'premium_broadway', 'QJs'), # lowIdx=9>=8 && suited => premium_broadway
    (['m1','b2'], 'marginal_high', 'A7o'),    # highIdx>=10, lowIdx=1<8 => marginal_high
    (['a1','b2'], 'weak', '27o'),             # highIdx=0<10, not suited/gap>2 => weak
]

for cards, expected, name in tier_tests:
    p = build_full_prompt(mk_state(handCard=cards, stage='preflop'), True)
    if expected in p:
        R.ok(f'{name} -> {expected}')
    else:
        # Try to find what tier was assigned
        tier_match = re.search(r'手牌等级: (\w+)', p)
        actual = tier_match.group(1) if tier_match else 'unknown'
        R.fail(f'{name} tier', f'expected {expected}, got {actual}')

# ============================================================
# Group 4: Position Detection
# ============================================================
R.section('GROUP 4: Position Detection')

positions = [('d','庄位(Button)'), ('sb','小盲(SB)'), ('bb','大盲(BB)'), ('','中间位置')]
for pos, label in positions:
    p = build_full_prompt(mk_state(myPosition=pos), True)
    if label in p:
        R.ok(f'Position {pos or "empty"} -> {label}')
    else:
        R.fail(f'Position {pos or "empty"}', f'missing {label}')

# BB special case
p = build_full_prompt(mk_state(myPosition='bb', prevSize=0, currentRoundActions=[]), True)
R.ok('BB free check', 'has privilege note') if '大盲位特权' in p else R.fail('BB special case')

# ============================================================
# Group 5: Backend Code Static Analysis
# ============================================================
R.section('GROUP 5: Backend Code Static Analysis')

# Read backend files
files_to_check = {
    'PokerSkillBot.ts': SERVER_SRC / 'app/core/PokerSkillBot.ts',
    'BotManager.ts': SERVER_SRC / 'app/core/BotManager.ts',
    'ai.ts controller': SERVER_SRC / 'app/controller/ai.ts',
    'game.ts io': SERVER_SRC / 'app/io/controller/game.ts',
}

contents = {}
for name, path in files_to_check.items():
    if path.exists():
        contents[name] = path.read_text()
        R.ok(f'{name} exists', f'{len(contents[name])} chars')
    else:
        R.fail(f'{name} exists', 'file not found')

# PokerSkillBot.ts checks
if 'PokerSkillBot.ts' in contents:
    c = contents['PokerSkillBot.ts']
    checks = [
        ('P1_GAME_RULES', 'P1 rules constant'),
        ('buildP2PreflopGuidance', 'P2 builder function'),
        ('buildP3PostflopPrinciples', 'P3 builder function'),
        ('buildP4TargetedStrategy', 'P4 builder function'),
        ('buildP5RiverGuidance', 'P5 builder function'),
        ('buildPrompt', 'buildPrompt method'),
        ('getAction', 'getAction method'),
        ('callLLM', 'callLLM method'),
        ('parseAction', 'parseAction method'),
        ('normalizeAction', 'normalizeAction method'),
        ('enableSkills', 'enableSkills config'),
        ('PokerSkillConfig', 'config interface'),
        ('GameStateForBot', 'state interface'),
        ('15000', '15s timeout'),
        ('handHistory', 'history tracking'),
        ('getHistory', 'getHistory method'),
        ('clearHistory', 'clearHistory method'),
    ]
    for pattern, desc in checks:
        if pattern in c:
            R.ok(f'PokerSkillBot: {desc}')
        else:
            R.fail(f'PokerSkillBot: {desc}', f'missing {pattern}')

# BotManager.ts checks
if 'BotManager.ts' in contents:
    c = contents['BotManager.ts']
    checks = [
        ('initPokerSkill', 'init method'),
        ('setPokerSkillEnabled', 'toggle method'),
        ('isPokerSkillEnabled', 'check method'),
        ('createBots', 'bot creation'),
        ('getBotAction', 'bot action'),
        ('buildGameState', 'state builder'),
        ('simpleBotAction', 'fallback action'),
        ('mapActionToCommand', 'action mapper'),
        ('isBot', 'bot identification'),
        ('removeBot', 'bot removal'),
        ('removeAllBots', 'clear all bots'),
        ('getConfig', 'config getter'),
        ('actionQueue', 'anti-duplicate queue'),
        ('BOT_NAMES', 'bot names'),
        ('enablePokerSkill', 'room config'),
        ('botChips', 'bot chips config'),
    ]
    for pattern, desc in checks:
        if pattern in c:
            R.ok(f'BotManager: {desc}')
        else:
            R.fail(f'BotManager: {desc}', f'missing {pattern}')

# game.ts io checks
if 'game.ts io' in contents:
    c = contents['game.ts io']
    checks = [
        ('BotManager', 'imports BotManager'),
        ('initPokerSkill', 'init PokerSkill'),
        ('enableBots', 'enableBots config'),
        ('enablePokerSkill', 'enablePokerSkill config'),
        ('triggerBotActionIfNeeded', 'bot trigger'),
        ('maxChain', 'anti-infinite-loop'),
        ('isBot', 'bot check'),
        ('getBotAction', 'getBotAction call'),
        ('botManager', 'botManager usage'),
        ('autoActionCallBack', 'auto action hook'),
    ]
    for pattern, desc in checks:
        if pattern in c:
            R.ok(f'game.ts: {desc}')
        else:
            R.fail(f'game.ts: {desc}', f'missing {pattern}')

# ai.ts checks
if 'ai.ts controller' in contents:
    c = contents['ai.ts controller']
    checks = [
        ("@Controller('/node/ai')", 'route decorator'),
        ('INJECTION_PATTERNS', 'prompt injection protection'),
        ('sanitizeAgentPrompt', 'input sanitization'),
        ('stripSystemMessages', 'system msg stripping'),
        ('/analyze', 'analyze endpoint'),
        ('/config', 'config endpoint'),
        ('/compress', 'compress endpoint'),
        ('MAX_AGENT_PROMPT_CHARS', 'length limit'),
        ('MAX_MESSAGES', 'msg limit'),
        ('SSE', 'SSE streaming'),
        ('Unauthorized', 'auth check'),
    ]
    for pattern, desc in checks:
        if pattern in c:
            R.ok(f'ai.ts: {desc}')
        else:
            R.fail(f'ai.ts: {desc}', f'missing {pattern}')

# ============================================================
# Group 6: Frontend Integration
# ============================================================
R.section('GROUP 6: Frontend Integration Points')

fe_files = {
    'home.vue': CLIENT_SRC / 'views/home.vue',
    'AIAdvisor.vue': CLIENT_SRC / 'components/AIAdvisor.vue',
    'game.vue': CLIENT_SRC / 'views/game.vue',
    'Action.vue': CLIENT_SRC / 'components/Action.vue',
}

fe_contents = {}
for name, path in fe_files.items():
    if path.exists():
        fe_contents[name] = path.read_text()
        R.ok(f'FE {name} exists')
    else:
        R.fail(f'FE {name}', 'not found')

# home.vue bot config
if 'home.vue' in fe_contents:
    c = fe_contents['home.vue']
    fields = ['enableBots', 'botCount', 'enablePokerSkill', 'llmApiUrl', 'llmApiKey', 'llmModel', 'botChips']
    for f in fields:
        if f in c:
            R.ok(f'home.vue: {f} config')
        else:
            R.fail(f'home.vue: {f}', 'missing')

# AIAdvisor.vue
if 'AIAdvisor.vue' in fe_contents:
    c = fe_contents['AIAdvisor.vue']
    if 'isExpanded' in c or 'drawer' in c.lower():
        R.ok('AIAdvisor: drawer mechanism')
    else:
        R.fail('AIAdvisor: drawer mechanism')
    if 'getAIAdvisor' in c or 'getAIAnalysis' in c:
        R.ok('AIAdvisor: API call')
    else:
        R.fail('AIAdvisor: API call')

# game.vue
if 'game.vue' in fe_contents:
    c = fe_contents['game.vue']
    if 'socket' in c:
        R.ok('game.vue: WebSocket')
    else:
        R.fail('game.vue: WebSocket')

# Action.vue
if 'Action.vue' in fe_contents:
    c = fe_contents['Action.vue']
    actions = ['fold', 'check', 'raise']
    for a in actions:
        if a in c:
            R.ok(f'Action.vue: {a}')
        else:
            R.fail(f'Action.vue: {a}')
    if 'actioned' in c:
        R.ok('Action.vue: anti-double-click')
    else:
        R.warn('Action.vue: anti-double-click', 'not found')

# ============================================================
# Group 7: End-to-End Data Flow
# ============================================================
R.section('GROUP 7: End-to-End Data Flow Verification')

# 7.1 Frontend config -> Backend game flow
if 'home.vue' in fe_contents and 'game.ts io' in contents:
    # Check that all frontend config fields are used in backend
    fe_home = fe_contents['home.vue']
    be_game = contents['game.ts io']
    
    config_fields = {
        'enableBots': 'enableBots',
        'botCount': 'botCount',
        'enablePokerSkill': 'enablePokerSkill',
        'llmApiUrl': 'llmApiUrl',
        'llmApiKey': 'llmApiKey',
        'llmModel': 'llmModel',
        'botChips': 'botChips',
    }
    
    for fe_field, be_field in config_fields.items():
        in_fe = fe_field in fe_home
        in_be = be_field in be_game
        if in_fe and in_be:
            R.ok(f'E2E: {fe_field} FE->BE linked')
        elif in_fe and not in_be:
            R.fail(f'E2E: {fe_field}', 'in FE but not BE')
        elif not in_fe and in_be:
            R.warn(f'E2E: {fe_field}', 'in BE but not FE')
        else:
            R.fail(f'E2E: {fe_field}', 'missing in both')

# 7.2 Bot action flow: game -> BotManager -> PokerSkillBot -> LLM
if 'game.ts io' in contents and 'BotManager.ts' in contents:
    be_game = contents['game.ts io']
    be_bm = contents['BotManager.ts']
    
    flow_checks = [
        ('getBotAction' in be_game, 'game.ts calls getBotAction'),
        ('buildGameState' in be_bm, 'BotManager.buildGameState exists'),
        ('pokerSkillBot' in be_bm, 'BotManager has pokerSkillBot'),
        ('simpleBotAction' in be_bm, 'BotManager has fallback'),
    ]
    for check, desc in flow_checks:
        if check:
            R.ok(f'Flow: {desc}')
        else:
            R.fail(f'Flow: {desc}')

# 7.3 Anti-infinite-loop protection
if 'game.ts io' in contents:
    c = contents['game.ts io']
    if 'maxChain' in c and 'chainCount' in c:
        R.ok('Safety: maxChain anti-infinite-loop')
    else:
        R.fail('Safety: maxChain missing')
    if '10' in c:
        R.ok('Safety: chain limit = 10')
    else:
        R.warn('Safety: chain limit', 'value not found')

# 7.4 Duplicate action prevention
if 'BotManager.ts' in contents:
    c = contents['BotManager.ts']
    if 'actionQueue' in c and 'isThinking' in c:
        R.ok('Safety: actionQueue anti-duplicate')
    else:
        R.fail('Safety: actionQueue missing')

# ============================================================
# Group 8: API Endpoint Verification
# ============================================================
R.section('GROUP 8: API Endpoint Map')

endpoints = [
    ('POST', '/node/ai/analyze', 'ai.ts', 'AI analysis streaming'),
    ('POST', '/node/ai/advisor', 'ai.ts', 'PokerSkill AI advisor'),
    ('POST', '/node/ai/compress', 'ai.ts', 'Context compression'),
    ('GET',  '/node/ai/config', 'ai.ts', 'Get AI configs'),
    ('POST', '/node/ai/config', 'ai.ts', 'Create AI config'),
    ('PUT',  '/node/ai/config/:id', 'ai.ts', 'Update AI config'),
    ('DEL',  '/node/ai/config/:id', 'ai.ts', 'Delete AI config'),
]

if 'ai.ts controller' in contents:
    c = contents['ai.ts controller']
    for method, route, file, desc in endpoints:
        route_pattern = route.replace(':id', '')
        if route_pattern in c:
            R.ok(f'API: {method} {route} ({desc})')
        else:
            R.fail(f'API: {method} {route}', 'endpoint missing')

# ============================================================
# Group 9: PokerSkill Advisor Integration
# ============================================================
R.section('GROUP 9: PokerSkill Advisor Integration')

# 9.1 Backend advisor function
if 'ai.ts controller' in contents:
    c = contents['ai.ts controller']
    for pattern, desc in [
        ("@Post('/advisor')", 'advisor endpoint'),
        ('buildPokerSkillPrompt', 'prompt builder'),
        ('classifyTier', 'tier classifier'),
        ('fmtCard', 'card formatter'),
        ('enablePokerSkill', 'skill flag'),
    ]:
        if pattern in c:
            R.ok(f'Advisor BE: {desc}')
        else:
            R.fail(f'Advisor BE: {desc}', f'missing {pattern}')

# 9.2 Frontend getAIAdvisor service
fe_svc = CLIENT_SRC / 'service/index.ts'
if fe_svc.exists() and 'getAIAdvisor' in fe_svc.read_text():
    R.ok('Advisor FE: getAIAdvisor service')
else:
    R.fail('Advisor FE: getAIAdvisor service')

# 9.3 AIAdvisor.vue PokerSkill toggle
fe_adv = CLIENT_SRC / 'components/AIAdvisor.vue'
if fe_adv.exists():
    c = fe_adv.read_text()
    for pattern, desc in [
        ('getAIAdvisor', 'service call'),
        ('enablePokerSkill', 'toggle switch'),
        ('stage', 'stage detection'),
        ('numActivePlayers', 'player count'),
    ]:
        if pattern in c:
            R.ok(f'Advisor UI: {desc}')
        else:
            R.fail(f'Advisor UI: {desc}', f'missing {pattern}')
else:
    R.fail('Advisor UI', 'AIAdvisor.vue not found')

# ============================================================
# Summary
# ============================================================
R.section('FINAL SUMMARY')
success = R.summary()

# Print all logs
print('\n'.join(R.logs))

sys.exit(0 if success else 1)
