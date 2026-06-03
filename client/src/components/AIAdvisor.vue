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
              <span class="ai-title">AI Advisor</span>
              <div class="ai-header-actions">
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
                >{{ enablePokerSkill ? 'P5' : 'P1' }}</span>
                <span
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
            <div class="ai-settings" v-if="showSettings">
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
                <div class="info-row" v-if="activeConfig.agent_prompt"><span>Style:</span> {{ activeConfig.agent_prompt }}</div>
              </div>
              <div class="ai-no-config" v-else>
                <p>No AI config found. Please set up in Home page.</p>
              </div>
              <button class="ai-save-btn" @click="closeDrawer">Close</button>
            </div>

            <!-- Content Panel -->
            <div class="ai-content" v-if="!showSettings">
              <div class="ai-nokey" v-if="!hasApiKey">
                <p>请在 ⚙ 设置中配置 AI API Key。</p>
              </div>
              <div class="ai-loading-content" v-else-if="loading && !streamText">
                <div class="ai-loading-text">分析中...</div>
                <div class="ai-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
              </div>
              <div class="ai-text" v-if="streamText">
                <div class="ai-section">
                  <div class="ai-section-text" v-html="renderMarkdown(streamText)"></div>
                </div>
              </div>
              <div class="ai-empty" v-else-if="!loading">
                <p>点击 ↻ 获取 AI 分析</p>
              </div>
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
  public loading = false;
  public hasError = false;

  // Analysis results
  public streamText = '';
  public suggestion = '';
  public handStrength = '';
  public actionAdvice = '';
  public generalAnalysis = '';

  // AI config from database
  public aiConfigs: any[] = [];
  public activeConfigId: number | null = null;

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
  public onHandCardChange(newCards: string[]) {
    if (this.prevHandCard.length > 0 && newCards.length > 0 &&
        JSON.stringify(newCards) !== JSON.stringify(this.prevHandCard)) {
      this.streamText = '';
      this.suggestion = '';
      this.handStrength = '';
      this.actionAdvice = '';
      this.generalAnalysis = '';
    }
    this.prevHandCard = [...newCards];
  }

  public mounted() {
    this.loadAIConfigs();
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

  public onSelectConfig() {
    // Config is selected, nothing extra needed
  }

  public openDrawer() {
    this.isExpanded = true;
  }

  public closeDrawer() {
    this.isExpanded = false;
    this.showSettings = false;
  }

  public saveSettings() {
    this.showSettings = false;
  }

  public async requestAnalysis() {
    if (this.loading || this.handCard.length === 0 || !this.hasApiKey) return;

    this.loading = true;
    this.hasError = false;
    this.streamText = '';

    const cfg = this.activeConfig;
    if (!cfg) { this.loading = false; return; }

    try {
      // Determine stage from commonCard count
      const cc = this.commonCard.length;
      const stage = cc === 0 ? 'preflop' : cc === 3 ? 'flop' : cc === 4 ? 'turn' : 'river';

      // Count active players
      const numActive = this.players.filter((p: any) => p.player && p.player.status === 1).length || 2;

      let fullText = '';

      service.getAIAdvisor(
        {
          // Game state for PokerSkill
          handCard: this.handCard,
          commonCard: this.commonCard,
          pot: this.pot,
          prevSize: this.prevSize,
          smallBlind: this.smallBlind,
          position: this.position,
          stage,
          numActivePlayers: Math.max(numActive, 2),
          enablePokerSkill: this.enablePokerSkill,
          // LLM config
          apiKey: cfg.api_key,
          apiUrl: cfg.api_url,
          model: cfg.model,
          agentPrompt: sanitizeUserPrompt(cfg.agent_prompt || ''),
        },
        (delta: string) => {
          fullText += delta;
          this.streamText = fullText;
        },
        (err: string) => {
          this.hasError = true;
          this.streamText = 'AI 分析出错: ' + err;
          this.loading = false;
        },
        () => {
          this.loading = false;
          this.suggestion = fullText;
        }
      );
    } catch (e) {
      this.streamText = 'AI 分析不可用，请检查 API Key。';
      this.hasError = true;
      this.loading = false;
    }
  }

  public renderMarkdown(text: string): string {
    if (!text) return '';
    const html = marked.parse(text, { breaks: true, gfm: true }) as string;
    return DOMPurify.sanitize(html);
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

      .ai-title {
        color: #d4af37;
        font-size: 15px;
        font-weight: 700;
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

      .ai-section {
        margin-bottom: 14px;

        .ai-section-title {
          color: #d4af37;
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ai-section-text {
          color: #ddd;
          font-size: 13px;
          word-break: break-word;
        }
      }

      .ai-empty {
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        padding: 40px 0;
        font-size: 12px;
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
