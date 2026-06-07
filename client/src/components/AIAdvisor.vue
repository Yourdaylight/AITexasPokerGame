<template>
  <div class="ai-advisor">
    <!-- Trigger button -->
    <div class="ai-trigger" @click="openDrawer" v-show="!isExpanded">
      <span class="ai-trigger-icon">🤖</span>
    </div>

    <!-- Overlay + Drawer -->
    <transition name="fade">
      <div class="ai-overlay" v-if="isExpanded" @click="closeDrawer">
        <transition name="slide">
          <div class="ai-drawer" @click.stop v-if="isExpanded">
            <!-- Header -->
            <div class="ai-header">
              <div class="ai-header-left">
                <span class="ai-title">{{ showHistory ? 'History' : 'AI Advisor' }}</span>
                <span class="ai-conv-id" v-if="!showHistory && !showSettings">
                  {{ currentConversationId ? `[ID:${currentConversationId}]` : '[New]' }}
                </span>
              </div>
              <div class="ai-header-actions">
                <span
                  class="ai-action-btn"
                  @click="toggleHistory"
                  :class="{ active: showHistory }"
                  title="History"
                >📜</span>
                <span
                  class="ai-action-btn"
                  @click="showSettings = !showSettings"
                  :class="{ active: showSettings }"
                  title="Settings"
                >⚙</span>
                <span
                  class="ai-action-btn"
                  @click="enablePokerSkill = !enablePokerSkill"
                  :class="{ active: enablePokerSkill }"
                  :title="enablePokerSkill ? 'PokerSkill ON (P1-P5)' : 'PokerSkill OFF (P1 only)'"
                >{{ enablePokerSkill ? '🧠 ON' : '🧠 OFF' }}</span>
                <span
                  v-if="!showHistory"
                  class="ai-action-btn"
                  @click="startNewConversation"
                  title="New Conversation"
                >➕</span>
                <span
                  v-if="!showHistory"
                  class="ai-action-btn"
                  @click="requestAnalysis"
                  :class="{ spinning: loading }"
                  title="Analyze"
                >↻</span>
                <span
                  class="ai-action-btn ai-close"
                  @click="closeDrawer"
                  title="Close"
                >✕</span>
              </div>
            </div>

            <!-- Settings Panel -->
            <div class="ai-settings" v-if="showSettings && !showHistory">
              <div class="ai-setting-item">
                <label>AI Config</label>
                <select v-model="activeConfigId" @change="onSelectConfig">
                  <option v-for="cfg in aiConfigs" :key="cfg.id" :value="cfg.id">
                    {{ cfg.name }} {{ cfg.is_default ? '(default)' : '' }}
                  </option>
                </select>
              </div>
              <div class="ai-config-info" v-if="activeConfig">
                <div class="info-row"><span>URL:</span> {{ activeConfig.api_url }}</div>
                <div class="info-row"><span>Model:</span> {{ activeConfig.model }}</div>
              </div>
              <div class="ai-no-config" v-else>
                <p>No AI config found. Please set up in Home page.</p>
              </div>
              <button class="ai-save-btn" @click="showSettings = false">Close</button>
            </div>

            <!-- History Panel -->
            <div class="ai-history" v-else-if="showHistory">
              <div class="ai-history-list" v-if="conversations.length > 0">
                <div
                  v-for="conv in conversations"
                  :key="conv.id"
                  class="ai-history-item"
                  :class="{ 'ai-history-active': conv.id === currentConversationId }"
                  @click="loadConversation(conv.id)"
                >
                  <div class="ai-history-title">{{ conv.title }}</div>
                  <div class="ai-history-meta">
                    <span>{{ conv.stage }}</span>
                    <span>{{ formatTime(conv.update_time) }}</span>
                  </div>
                  <div class="ai-history-cards" v-if="conv.hand_card">
                    <span>🂠 {{ conv.hand_card }}</span>
                  </div>
                </div>
              </div>
              <div class="ai-empty" v-else>
                <p>No history yet</p>
              </div>
            </div>

            <!-- Content Panel -->
            <div class="ai-content" v-else-if="!showSettings" ref="contentArea">
              <div class="ai-nokey" v-if="!hasApiKey">
                <p>请在 ⚙ 设置中配置 AI API Key。</p>
              </div>
              <div class="ai-loading-content" v-else-if="loading && messages.length === 0">
                <div class="ai-loading-text">分析中...</div>
                <div class="ai-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
              </div>
              <div class="ai-empty" v-if="!loading && messages.length === 0">
                <p>点击 ↻ 获取 AI 分析</p>
              </div>
              <div class="ai-message-list" v-if="messages.length > 0">
                <div
                  v-for="(msg, index) in messages"
                  :key="index"
                  class="ai-message"
                  :class="{ 'ai-message-user': msg.role === 'user', 'ai-message-assistant': msg.role === 'assistant' }"
                >
                  <div class="ai-message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
                  <div class="ai-message-body">
                    <div class="ai-message-text" v-html="renderMessage(msg.content)"></div>
                  </div>
                </div>
                <div class="ai-message ai-message-assistant" v-if="loading && currentStreaming">
                  <div class="ai-message-avatar">🤖</div>
                  <div class="ai-message-body">
                    <div class="ai-message-text" v-html="renderMessage(currentStreaming)"></div>
                    <span class="ai-cursor"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Input Area - Fixed at bottom of drawer -->
          <div class="ai-input-area" v-show="!showSettings && !showHistory">
            <template v-if="hasApiKey">
              <input
                type="text"
                v-model="userInput"
                @keyup.enter="sendUserMessage"
                placeholder="追问 AI..."
                :disabled="loading"
              />
              <button @click="sendUserMessage" :disabled="loading || !userInput.trim()">➤</button>
            </template>
            <div v-else class="ai-input-nokey">
              <span>⚠️ 请在 ⚙ 设置中配置 AI API Key</span>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import service from '@/service';
import { sanitizeUserPrompt } from '@/utils/aiContext';
import { poke2String } from '@/utils/map';

const marked = require('marked');
const DOMPurify = require('dompurify');

@Component
export default class AIAdvisor extends Vue {
  @Prop({ default: () => [] }) public handCard!: string[];
  @Prop({ default: () => [] }) public commonCard!: string[];
  @Prop({ default: 0 }) public pot!: number;
  @Prop({ default: false }) public isAction!: boolean;
  @Prop({ default: () => [] }) public players!: any[];
  @Prop({ default: 0 }) public prevSize!: number;
  @Prop({ default: 0 }) public smallBlind!: number;
  @Prop({ default: '' }) public position!: string | null;
  @Prop({ default: () => [] }) public currentRoundActions!: any[];
  @Prop({ default: '' }) public roomId!: string;

  // UI state
  public isExpanded = false;
  public showSettings = false;
  public showHistory = false;
  public loading = false;
  public hasError = false;

  // Analysis results - chat-style message history
  public messages: Array<{ role: string; content: string }> = [];
  public currentStreaming = '';
  public suggestion = '';
  public userInput = '';

  // AI config from database
  public aiConfigs: any[] = [];
  public activeConfigId: number | null = null;

  // Conversation history
  public conversations: any[] = [];
  public currentConversationId: number | null = null;

  // Computed current config
  get activeConfig() {
    return this.aiConfigs.find((c: any) => c.id === this.activeConfigId) || null;
  }

  // Context
  private prevHandCard: string[] = [];

  // PokerSkill toggle
  public enablePokerSkill = true;

  get hasApiKey() {
    return !!(this.activeConfig && this.activeConfig.api_key);
  }

  @Watch('handCard')
  public async onHandCardChange(newCards: string[]) {
    const changed = JSON.stringify(newCards) !== JSON.stringify(this.prevHandCard);
    if (changed && this.messages.length > 0) {
      // New hand dealt, save previous conversation and start fresh
      await this.saveCurrentConversation();
      this.messages = [];
      this.currentStreaming = '';
      this.suggestion = '';
      this.currentConversationId = null;
      console.log('[AI-Advisor] New hand detected, conversation reset');
    }
    this.prevHandCard = [...newCards];
  }

  public async mounted() {
    await this.loadAIConfigs();
    await this.loadConversations();
    // Auto-restore latest conversation for current room
    if (this.roomId) {
      await this.restoreCurrentRoomConversation();
    }
  }

  public async loadAIConfigs() {
    try {
      const result = await service.getAIConfigs();
      this.aiConfigs = result.data || [];
      if (this.aiConfigs.length > 0) {
        const defaultCfg = this.aiConfigs.find((c: any) => c.is_default);
        this.activeConfigId = defaultCfg ? defaultCfg.id : this.aiConfigs[0].id;
      }
    } catch (e) {
      console.log('loadAIConfigs error:', e);
    }
  }

  public async loadConversations() {
    try {
      const result = await service.getAIConversations();
      this.conversations = result.data || [];
    } catch (e) {
      console.log('loadConversations error:', e);
    }
  }

  public async loadConversation(id: number) {
    try {
      const result = await service.getAIConversationDetail(id);
      const conv = result.data;
      if (conv && conv.messages) {
        this.messages = conv.messages;
        this.currentConversationId = conv.id;
        this.showHistory = false;
        this.scrollToBottom();
      }
    } catch (e) {
      console.log('loadConversation error:', e);
    }
  }

  public async saveCurrentConversation() {
    if (this.messages.length === 0) return;
    try {
      const cc = this.commonCard.length;
      const stage = cc === 0 ? 'preflop' : cc === 3 ? 'flop' : cc === 4 ? 'turn' : 'river';
      const payload = {
        id: this.currentConversationId,
        roomId: this.roomId,
        handCard: this.handCard,
        commonCard: this.commonCard,
        stage,
        messages: this.messages,
      };
      const result = await service.saveAIConversation(payload);
      if (result.data && result.data.id) {
        this.currentConversationId = result.data.id;
      }
      await this.loadConversations();
    } catch (e) {
      console.log('saveCurrentConversation error:', e);
    }
  }

  public async startNewConversation() {
    if (this.messages.length > 0) {
      await this.saveCurrentConversation();
    }
    this.messages = [];
    this.currentStreaming = '';
    this.suggestion = '';
    this.currentConversationId = null;
    this.showHistory = false;
    this.showSettings = false;
    console.log('[AI-Advisor] Started new conversation');
  }

  public toggleHistory() {
    this.showHistory = !this.showHistory;
    this.showSettings = false;
    if (this.showHistory) {
      this.loadConversations();
    }
  }

  public onSelectConfig() {
    // Config is selected, nothing extra needed
  }

  public async openDrawer() {
    this.isExpanded = true;
    // Restore conversation if messages empty but we have a saved one
    if (this.messages.length === 0 && this.currentConversationId) {
      // Check if the saved conversation matches current hand
      const conv = this.conversations.find((c: any) => c.id === this.currentConversationId);
      const convHandCard = conv?.hand_card || '';
      const currentHandCard = Array.isArray(this.handCard) ? this.handCard.join(',') : '';
      if (convHandCard && convHandCard !== currentHandCard) {
        // Hand changed, don't load old conversation
        this.currentConversationId = null;
        console.log('[AI-Advisor] Hand changed, skipping old conversation load');
      } else {
        await this.loadConversation(this.currentConversationId);
      }
    }
  }

  public async closeDrawer() {
    await this.saveCurrentConversation();
    this.isExpanded = false;
    this.showSettings = false;
    this.showHistory = false;
  }

  public formatTime(timeStr: string): string {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  public scrollToBottom() {
    this.$nextTick(() => {
      const el = this.$refs.contentArea as HTMLElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  public saveSettings() {
    this.showSettings = false;
  }

  private async restoreCurrentRoomConversation() {
    try {
      // Find latest conversation for current room from loaded list
      const roomConvs = this.conversations.filter((c: any) => c.room_id === this.roomId);
      if (roomConvs.length > 0) {
        // Sort by update_time desc, pick latest
        roomConvs.sort((a: any, b: any) => new Date(b.update_time).getTime() - new Date(a.update_time).getTime());
        const latest = roomConvs[0];
        this.currentConversationId = latest.id;
        console.log(`[AI-Advisor] Auto-restored conversation ID:${latest.id} for room ${this.roomId}`);
      }
    } catch (e) {
      console.log('restoreCurrentRoomConversation error:', e);
    }
  }

  private formatCards(cards: string[]): string {
    if (!cards || cards.length === 0) return '无';
    const mapped = poke2String(cards);
    return mapped.join(' ');
  }

  private getStageName(stage: string): string {
    const names: Record<string, string> = {
      preflop: '翻前',
      flop: '翻牌',
      turn: '转牌',
      river: '河牌',
    };
    return names[stage] || stage;
  }

  private buildGameStatePrompt(): string {
    const cc = this.commonCard.length;
    const stage = cc === 0 ? 'preflop' : cc === 3 ? 'flop' : cc === 4 ? 'turn' : 'river';
    const handStr = this.formatCards(this.handCard);
    const boardStr = this.formatCards(this.commonCard);
    return `🂠 手牌: ${handStr}\n🎴 公共牌: ${boardStr}\n💰 底池: ${this.pot}\n📍 阶段: ${this.getStageName(stage)}`;
  }

  public async sendUserMessage() {
    const text = this.userInput.trim();
    console.log('[AI-Advisor] sendUserMessage', { text: !!text, loading: this.loading, hasApiKey: this.hasApiKey, activeConfigId: this.activeConfigId });
    if (!text || this.loading || !this.hasApiKey) return;

    const sessionId = this.roomId || 'unknown';
    console.log(`[AI-Advisor][${sessionId}] User message: ${text}`);

    this.messages.push({ role: 'user', content: text });
    this.userInput = '';
    this.scrollToBottom();

    await this.callAIWithContext();
  }

  public async requestAnalysis() {
    if (this.loading || this.handCard.length === 0 || !this.hasApiKey) return;

    // Auto-add game state as first user message if empty
    if (this.messages.length === 0) {
      const prompt = this.buildGameStatePrompt();
      this.messages.push({ role: 'user', content: prompt });
      this.scrollToBottom();
    }

    await this.callAIWithContext();
  }

  private async callAIWithContext() {
    if (this.loading || !this.hasApiKey) return;

    this.loading = true;
    this.hasError = false;
    this.currentStreaming = '';

    const cfg = this.activeConfig;
    if (!cfg) { this.loading = false; return; }

    try {
      const cc = this.commonCard.length;
      const stage = cc === 0 ? 'preflop' : cc === 3 ? 'flop' : cc === 4 ? 'turn' : 'river';
      const numActive = this.players.filter((p: any) => p.player && p.player.status === 1).length || 2;

      let fullText = '';
      console.log('[AI-Advisor] callAIWithContext start');

      service.getAIAdvisor(
        {
          handCard: this.handCard,
          commonCard: this.commonCard,
          pot: this.pot,
          prevSize: this.prevSize,
          smallBlind: this.smallBlind,
          position: this.position,
          stage,
          numActivePlayers: Math.max(numActive, 2),
          enablePokerSkill: this.enablePokerSkill,
          apiKey: cfg.api_key,
          apiUrl: cfg.api_url,
          model: cfg.model,
          agentPrompt: sanitizeUserPrompt(cfg.agent_prompt || ''),
        },
        (delta: string) => {
          fullText += delta;
          this.currentStreaming = fullText;
          console.log('[AI-Advisor] onMessage delta, fullText length', fullText.length);
          this.scrollToBottom();
        },
        (err: string) => {
          console.error('[AI-Advisor] onError', err);
          this.hasError = true;
          this.currentStreaming = '';
          this.messages.push({ role: 'assistant', content: 'AI 分析出错: ' + err });
          this.loading = false;
          this.scrollToBottom();
        },
        () => {
          console.log('[AI-Advisor] onClose, fullText length', fullText.length);
          this.loading = false;
          this.suggestion = fullText;
          if (fullText) {
            this.messages.push({ role: 'assistant', content: fullText });
            console.log('[AI-Advisor] pushed assistant message');
          } else {
            console.warn('[AI-Advisor] onClose with empty fullText');
          }
          this.currentStreaming = '';
          this.scrollToBottom();
        }
      );
    } catch (e) {
      console.error('[AI-Advisor] callAIWithContext catch', e);
      this.messages.push({ role: 'assistant', content: 'AI 分析不可用，请检查 API Key。' });
      this.hasError = true;
      this.loading = false;
      this.scrollToBottom();
    }
  }

  public renderMessage(text: string): string {
    if (!text) return '';

    // Try to parse JSON action card (append it after the main content)
    const actionCard = this.tryParseJsonResponse(text);

    // Remove the JSON block from text so it doesn't render as plain text/code
    let displayText = text;
    const jsonMatch = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (jsonMatch) {
      displayText = text.replace(jsonMatch[0], '').trim();
      // Clean up leftover markdown code fences
      displayText = displayText.replace(/```\s*json\s*$/gi, '').replace(/```\s*$/g, '').trim();
    }

    // Render main content (thinking process / reasoning) as markdown
    const mainHtml = displayText
      ? DOMPurify.sanitize(marked.parse(displayText, { breaks: true, gfm: true }) as string)
      : '';

    if (mainHtml && actionCard) {
      return `<div class="ai-thinking-content">${mainHtml}</div>${actionCard}`;
    }
    if (actionCard) {
      return actionCard;
    }
    return mainHtml;
  }

  private tryParseJsonResponse(text: string): string | null {
    const jsonMatch = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const action = parsed.action || '';
      const reasoning = parsed.reasoning || '';
      if (!action) return null;

      const actionLabels: Record<string, string> = {
        fold: '弃牌',
        check: '过牌',
        call: '跟注',
        allin: '全下',
      };

      let actionHtml = '';
      if (action.startsWith('raise:')) {
        const size = action.split(':')[1];
        actionHtml = `<span class="ai-action-tag ai-action-raise">加注到 ${size}</span>`;
      } else {
        const label = actionLabels[action] || action;
        const actionClass = `ai-action-${action.split(':')[0]}`;
        actionHtml = `<span class="ai-action-tag ${actionClass}">${label}</span>`;
      }

      return `
        <div class="ai-action-result">
          <div class="ai-action-row">建议操作: ${actionHtml}</div>
          ${reasoning ? `<div class="ai-reasoning">💡 ${reasoning}</div>` : ''}
        </div>
      `;
    } catch (e) {
      return null;
    }
  }
}
</script>

<style lang="less" scoped>
.ai-advisor {
  .ai-trigger {
    position: fixed;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #d4af37, #c49b2a);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }

    .ai-trigger-icon {
      font-size: 22px;
    }
  }

  .ai-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 200;
    display: flex;
    justify-content: flex-end;
  }

  .ai-drawer {
    width: 420px;
    max-width: 85vw;
    height: 100%;
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    border-left: 1px solid var(--border-medium);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;

      .ai-header-left {
        display: flex;
        align-items: center;
      }

      .ai-title {
        color: #d4af37;
        font-size: 15px;
        font-weight: 700;
      }

      .ai-conv-id {
        color: rgba(212, 175, 55, 0.6);
        font-size: 11px;
        font-weight: 400;
        margin-left: 8px;
        font-family: monospace;
        background: rgba(212, 175, 55, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
      }

      .ai-header-actions {
        display: flex;
        gap: 12px;

        .ai-action-btn {
          color: rgba(212, 175, 55, 0.7);
          cursor: pointer;
          font-size: 16px;
          transition: color 0.2s;
          user-select: none;

          &:hover { color: #d4af37; }
          &.active { color: #d4af37; }

          &.spinning {
            display: inline-block;
            animation: spin 1s linear infinite;
          }

          &.ai-close {
            font-size: 18px;
            margin-left: 4px;
          }
        }
      }
    }

    .ai-settings {
      padding: 12px 16px;
      overflow-y: auto;
      flex: 1;

      .ai-setting-item {
        margin-bottom: 10px;

        label {
          display: block;
          color: rgba(212, 175, 55, 0.7);
          font-size: 11px;
          margin-bottom: 4px;

          .char-count {
            color: rgba(255, 255, 255, 0.3);
            font-size: 10px;
          }
        }

        input, textarea, select {
          width: 100%;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: var(--radius-sm);
          color: #e0e0e0;
          font-size: 12px;
          box-sizing: border-box;
          font-family: inherit;

          &:focus {
            outline: none;
            border-color: rgba(212, 175, 55, 0.6);
          }
        }
        select {
          cursor: pointer;
          option { background: #0d2e1e; color: #e0e0e0; }
        }

      .ai-config-info {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(212, 175, 55, 0.15);
        border-radius: 4px;
        padding: 10px;
        margin-bottom: 10px;
        .info-row {
          color: #ccc;
          font-size: 12px;
          margin-bottom: 4px;
          word-break: break-all;
          span {
            color: rgba(212, 175, 55, 0.7);
            font-size: 11px;
            margin-right: 4px;
          }
        }
      }

      .ai-no-config {
        text-align: center;
        padding: 20px 0;
        p {
          color: rgba(212, 175, 55, 0.6);
          font-size: 12px;
        }
      }

        textarea {
          resize: vertical;
          min-height: 50px;
        }
      }

      .ai-save-btn {
        width: 100%;
        padding: 8px 0;
        background: linear-gradient(135deg, #d4af37, #c49b2a);
        color: #0a0a0a;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 6px;

        &:hover { background: linear-gradient(135deg, #e5c349, #d4af37); }
      }
    }

    .ai-content {
      padding: 12px 16px;
      overflow-y: auto;
      flex: 1;
      font-size: 14px;
      color: var(--text-primary);
      line-height: 1.7;

      .ai-nokey {
        text-align: center;
        color: rgba(212, 175, 55, 0.6);
        padding: 40px 0;
        font-size: 12px;
        line-height: 1.6;
      }

      .ai-loading-content {
        text-align: center;
        padding: 40px 0;

        .ai-loading-text {
          color: rgba(212, 175, 55, 0.8);
          font-size: 13px;
          margin-bottom: 10px;
        }

        .ai-dots {
          display: flex;
          justify-content: center;

          .dot {
            width: 6px; height: 6px;
            background: #d4af37;
            border-radius: 50%;
            margin: 0 3px;
            animation: dotPulse 1.4s ease-in-out infinite;
            &:nth-child(2) { animation-delay: 0.2s; }
            &:nth-child(3) { animation-delay: 0.4s; }
          }
        }
      }

      .ai-message-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .ai-message {
        display: flex;
        gap: 10px;
        align-items: flex-start;

        .ai-message-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .ai-message-body {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 10px 14px;
          min-width: 0;

          .ai-message-text {
            color: #ddd;
            font-size: 13px;
            word-break: break-word;
            line-height: 1.6;

            :deep(p) { margin: 0 0 8px 0; }
            :deep(p:last-child) { margin-bottom: 0; }
            :deep(ul, ol) { margin: 4px 0; padding-left: 16px; }
            :deep(li) { margin: 2px 0; }
            :deep(code) {
              background: rgba(212, 175, 55, 0.15);
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 12px;
            }
            :deep(pre) {
              background: rgba(0, 0, 0, 0.3);
              padding: 10px;
              border-radius: 6px;
              overflow-x: auto;
            }
          }

          .ai-cursor {
            display: inline-block;
            width: 2px;
            height: 16px;
            background: #d4af37;
            margin-left: 2px;
            animation: blink 1s step-end infinite;
            vertical-align: middle;
          }
        }
      }

      .ai-message-user {
        flex-direction: row-reverse;

        .ai-message-body {
          background: rgba(212, 175, 55, 0.12);
          border: 1px solid rgba(212, 175, 55, 0.2);
        }
      }

      .ai-empty {
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        padding: 40px 0;
        font-size: 12px;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      // AI Action Result styling
      .ai-action-result {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(212, 175, 55, 0.25);
        .ai-action-row {
          margin-bottom: 8px;
          font-size: 14px;
          color: #e0e0e0;
        }
        .ai-action-tag {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 13px;
          margin-left: 6px;
        }
        .ai-action-fold {
          background: rgba(231, 76, 60, 0.2);
          color: #e74c3c;
          border: 1px solid rgba(231, 76, 60, 0.3);
        }
        .ai-action-check {
          background: rgba(52, 152, 219, 0.2);
          color: #3498db;
          border: 1px solid rgba(52, 152, 219, 0.3);
        }
        .ai-action-call {
          background: rgba(46, 204, 113, 0.2);
          color: #2ecc71;
          border: 1px solid rgba(46, 204, 113, 0.3);
        }
        .ai-action-raise {
          background: rgba(155, 89, 182, 0.2);
          color: #9b59b6;
          border: 1px solid rgba(155, 89, 182, 0.3);
        }
        .ai-action-allin {
          background: rgba(230, 126, 34, 0.2);
          color: #e67e22;
          border: 1px solid rgba(230, 126, 34, 0.3);
        }
        .ai-reasoning {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          line-height: 1.6;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
      }

    }

    // Input area - fixed at bottom of drawer
    .ai-input-area {
      display: flex;
      gap: 8px;
      padding: 10px 16px;
      border-top: 1px solid rgba(212, 175, 55, 0.15);
      background: rgba(0, 0, 0, 0.2);
      flex-shrink: 0;

      input {
        flex: 1;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 4px;
        color: #e0e0e0;
        font-size: 13px;
        outline: none;

        &:focus {
          border-color: rgba(212, 175, 55, 0.5);
        }

        &::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        &:disabled {
          opacity: 0.5;
        }
      }

      button {
        width: 36px;
        height: 36px;
        border-radius: 4px;
        background: linear-gradient(135deg, #d4af37, #c49b2a);
        border: none;
        color: #0a0a0a;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &:hover:not(:disabled) {
          transform: scale(1.05);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      .ai-input-nokey {
        flex: 1;
        text-align: center;
        color: rgba(212, 175, 55, 0.7);
        font-size: 13px;
        padding: 8px 0;
      }
    }

    // History Panel
    .ai-history {
      padding: 12px 16px;
      overflow-y: auto;
      flex: 1;

      .ai-history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ai-history-item {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(212, 175, 55, 0.15);
        border-radius: 8px;
        padding: 10px 12px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: rgba(212, 175, 55, 0.08);
          border-color: rgba(212, 175, 55, 0.3);
        }

        &.ai-history-active {
          background: rgba(212, 175, 55, 0.12);
          border-color: rgba(212, 175, 55, 0.5);
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.15);
        }

        .ai-history-title {
          color: #d4af37;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .ai-history-meta {
          display: flex;
          gap: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          margin-bottom: 4px;
        }

        .ai-history-cards {
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
        }
      }
    }
  }
}

// Transitions
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter, .slide-leave-to {
  transform: translateX(100%);
}

// Animations
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}
</style>
