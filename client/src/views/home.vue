<template>
  <div class="home-container container">
    <div class="room-btn" v-show="isHome">
      <div class="welcome-message">
      Have a good day, {{ userAccount }}!
      </div>
      <div class="room-config" v-show="showRoomConfig">
        <div class="room-config-shadow" @click="showRoomConfig = false"></div>
        <div class="room-config-body">
          <h1>room config</h1>
          <div class="input-bd">
            <div class="input-name">smallBlind:</div>
            <div class="input-text">
              <input type="tel" v-model="smallBlind" />
            </div>
          </div>
          <div class="input-bd">
            <div class="input-name">isShort:</div>
            <div class="input-text">
              <input type="checkbox" v-model="isShort" />
            </div>
          </div>
          <!-- Bot / PokerSkill Config -->
          <div style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
            <h3 style="color: var(--accent-gold); font-size: 14px; margin-bottom: 10px;">AI Bot 配置</h3>
            <div class="input-bd">
              <div class="input-name">启用AI:</div>
              <div class="input-text">
                <input type="checkbox" v-model="enableBots" />
              </div>
            </div>
            <div v-if="enableBots">
              <div class="input-bd">
                <div class="input-name">AI数量:</div>
                <div class="input-text">
                  <input type="tel" v-model="botCount" min="1" max="8" />
                </div>
              </div>
              <div class="input-bd">
                <div class="input-name">PokerSkill:</div>
                <div class="input-text">
                  <input type="checkbox" v-model="enablePokerSkill" />
                  <span style="color: var(--text-secondary); font-size: 11px; margin-left: 6px;">
                    {{ enablePokerSkill ? '策略模式 (P1-P5)' : '基准模式 (P1)' }}
                  </span>
                </div>
              </div>
              <div class="input-bd">
                <div class="input-name">AI筹码:</div>
                <div class="input-text">
                  <input type="tel" v-model="botChips" />
                </div>
              </div>
              <div class="input-bd">
                <div class="input-name">LLM API:</div>
                <div class="input-text">
                  <input type="text" v-model="botLlmApiUrl" placeholder="https://api.openai.com/v1/chat/completions" />
                </div>
              </div>
              <div class="input-bd">
                <div class="input-name">API Key:</div>
                <div class="input-text">
                  <input type="password" v-model="botLlmApiKey" placeholder="sk-..." />
                </div>
              </div>
              <div class="input-bd">
                <div class="input-name">模型:</div>
                <div class="input-text">
                  <input type="text" v-model="botLlmModel" placeholder="gpt-4o" />
                </div>
              </div>
            </div>
          </div>
          <div class="btn" @click="createRoom"><span>create</span></div>
        </div>
      </div>

      <!-- AI Config Panel -->
      <div class="ai-config" v-show="showAIConfig">
        <div class="ai-config-shadow" @click="showAIConfig = false"></div>
        <div class="ai-config-body">
          <h1>AI Configuration</h1>
          <div class="ai-config-field">
            <label>Saved Configs</label>
            <div class="config-selector">
              <select v-model="selectedConfigId" @change="onSelectConfig">
                <option :value="null">-- New Config --</option>
                <option v-for="cfg in aiConfigs" :key="cfg.id" :value="cfg.id">
                  {{ cfg.name }} {{ cfg.is_default ? '(default)' : '' }}
                </option>
              </select>
              <button class="btn-icon" @click="newConfig" title="New">+</button>
              <button class="btn-icon btn-danger" v-if="selectedConfigId" @click="deleteAIConfig" title="Delete">&#x1F5D1;</button>
            </div>
          </div>
          <div class="ai-config-field">
            <label>Name</label>
            <input type="text" v-model="aiConfigName" placeholder="Config name" />
          </div>
          <div class="ai-config-field">
            <label>API Key</label>
            <input type="password" v-model="aiApiKey" placeholder="Enter your DeepSeek API key" />
          </div>
          <div class="ai-config-field">
            <label class="checkbox-label">
              <input type="checkbox" v-model="aiIsDefault" /> Set as default
            </label>
          </div>
          <div class="ai-config-status" v-if="aiTestStatus">
            <span :class="aiTestStatus === 'success' ? 'status-ok' : 'status-fail'">{{ aiTestMessage }}</span>
          </div>
          <div class="ai-config-actions">
            <button class="btn-test" @click="testAIConfig" :disabled="aiTesting">
              {{ aiTesting ? 'Testing...' : 'Test Connection' }}
            </button>
            <button class="btn-save" @click="saveAIConfig" :disabled="aiTesting">Save</button>
          </div>
        </div>
      </div>

      <div class="create-room btn" @click="showRoomConfig = true"><span>create room</span></div>
      <div class="btn" @click="joinRoom"><span>join room</span></div>
      <div class="btn" @click="getRecord(0)"><span>test record</span></div>
      <div class="btn" @click="selfPast7DayGame()">
        <span>7 day game history</span>
      </div>
      <div class="btn" v-if="isAdmin" @click="goAdmin">
        <span>Admin Panel</span>
      </div>
      <div class="btn" @click="showAIConfig = true">
        <span>AI Config</span>
      </div>
      <div class="btn btn-logout" @click="logout">
        <span>Logout</span>
      </div>
    </div>

    <div class="room-number" v-show="isJoin">
      <div class="back-to-home" @click="backToHome">Home</div>
      <div class="room-input inline">
        <div class="input-bd" :class="{ error: isError }">
          <div class="input-name iconfont icon-password" :style="{ minWidth: 0, width: '32px' }"></div>
          <div class="input-text">
            <input type="tel" maxlength="6" @focus="isError = false" v-model="roomNumber" />
          </div>
        </div>
      </div>
      <div class="room-btn inline">
        <span @click="go">GO</span>
      </div>

      <div v-if="rooms.length > 0">
        <p>热门房间</p>
        <table class="hot-rooms" width="100%">
          <thead>
            <tr>
              <th class="hot-room-number">房间号</th>
              <th class="hot-room-player">玩家</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="room in rooms">
              <td class="hot-room-number" :data-roomNumber="room.roomNumber" @click="goByEvent($event)">
                {{ room.roomNumber }}
              </td>
              <td class="hot-room-player">{{ room.playersNickName }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <gameRecord
      v-model="showRecord"
      :game-list="gameList"
      :curr-game-index="currGameIndex"
      @getRecord="getRecord"
      :command-list="commandList"
    ></gameRecord>
  </div>
</template>

<script lang="ts">
import gameRecord from '@/components/GameRecord.vue';
import { IGameRecord } from '@/interface/IGameRecord';
import { IRoomBasicInfo } from '@/interface/IRoom';
import cookie from 'js-cookie';
import Component from 'vue-class-component';
import { Vue, Watch } from 'vue-property-decorator';
import service from '../service';
import origin from '../utils/origin';
import { sanitizeUserPrompt } from '../utils/aiContext';

@Component({
  components: {
    gameRecord,
  },
})
export default class Home extends Vue {
  public roomNumber: string = '';
  public isJoin = false;
  public isHome = true;
  public isError = false;
  public isShort = false;
  public smallBlind = 1;
  public showRoomConfig = false;
  public showRecord = false;
  public commandList = [];
  public currGameIndex = 0;
  public gameList: IGameRecord[] = [];
  public rooms: IRoomBasicInfo[] = [];

  // AI Config
  public showAIConfig = false;
  public aiConfigs: any[] = [];
  public selectedConfigId: number | null = null;
  public aiConfigName = '';
  public aiApiKey = '';
  public aiApiUrl = 'https://api.deepseek.com/v1/chat/completions';
  public aiModel = 'deepseek-v4-flash';
  public activePreset = 'custom';
  public agentPrompt = '';
  public aiIsDefault = false;

  // Bot / PokerSkill Config (defaults to DeepSeek)
  public enableBots = false;
  public botCount = 2;
  public enablePokerSkill = true;
  public botLlmApiUrl = 'https://api.deepseek.com/v1/chat/completions';
  public botLlmApiKey = 'sk-34c10960629441a9b7d0a1ba3ee6c3f5';
  public botLlmModel = 'deepseek-v4-flash';
  public botChips = 1000;

  public aiTesting = false;
  public aiTestStatus = '';
  public aiTestMessage = '';

  private static PRESETS: Record<string, { url: string; key: string; model: string }> = {
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: '',
      model: 'deepseek-v4-flash',
    },
  };

  public async mounted() {
    this.activePreset = this.detectPreset();
    await this.getRooms();
    await this.loadAIConfigs();
  }

  @Watch('showAIConfig')
  public onShowAIConfigChange(val: boolean) {
    if (val) {
      this.loadAIConfigs();
    }
  }

  public async loadAIConfigs() {
    try {
      const result = await service.getAIConfigs();
      this.aiConfigs = result.data || [];
      // If no config selected and we have configs, select default or first
      if (this.selectedConfigId === null && this.aiConfigs.length > 0) {
        const defaultCfg = this.aiConfigs.find((c: any) => c.is_default);
        if (defaultCfg) {
          this.selectConfig(defaultCfg.id);
        }
      }
    } catch (e) {
      console.log('loadAIConfigs error:', e);
    }
  }

  public onSelectConfig() {
    if (this.selectedConfigId === null) {
      this.newConfig();
      return;
    }
    this.selectConfig(this.selectedConfigId);
  }

  public selectConfig(id: number) {
    const cfg = this.aiConfigs.find((c: any) => c.id === id);
    if (!cfg) return;
    this.selectedConfigId = cfg.id;
    this.aiConfigName = cfg.name || '';
    this.aiApiUrl = cfg.api_url || '';
    this.aiApiKey = cfg.api_key || '';
    this.aiModel = cfg.model || '';
    this.agentPrompt = cfg.agent_prompt || '';
    this.aiIsDefault = !!cfg.is_default;
    this.activePreset = this.detectPreset();
  }

  public newConfig() {
    this.selectedConfigId = null;
    this.aiConfigName = '';
    this.aiApiKey = '';
    this.aiApiUrl = 'https://api.deepseek.com/v1/chat/completions';
    this.aiModel = 'deepseek-v4-flash';
    this.agentPrompt = '';
    this.aiIsDefault = false;
    this.activePreset = 'custom';
  }

  public async deleteAIConfig() {
    if (!this.selectedConfigId) return;
    if (!confirm('Delete this config?')) return;
    try {
      await service.deleteAIConfig(this.selectedConfigId);
      this.$plugin && this.$plugin.toast('Config deleted');
      await this.loadAIConfigs();
      this.newConfig();
    } catch (e) {
      this.$plugin && this.$plugin.toast('Delete failed');
    }
  }

  get userAccount() {
    return localStorage.getItem('userAccount') || 'Please Login!';
  }

  get isAdmin() {
    return localStorage.getItem('isAdmin') === '1';
  }

  private detectPreset(): string {
    for (const [name, preset] of Object.entries(Home.PRESETS)) {
      if (this.aiApiUrl === preset.url && this.aiModel === preset.model) {
        return name;
      }
    }
    return 'custom';
  }

  public applyPreset(name: string) {
    this.activePreset = name;
    if (name === 'custom') {
      return;
    }
    const preset = Home.PRESETS[name];
    if (preset) {
      this.aiApiUrl = preset.url;
      this.aiModel = preset.model;
      if (preset.key) {
        this.aiApiKey = preset.key;
      }
    }
  }

  public goAdmin() {
    this.$router.push({ name: 'admin' });
  }

  public logout() {
    cookie.remove('token');
    cookie.remove('user_id');
    cookie.remove('roomConfig');
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userAccount');
    this.$router.replace({ name: 'login' });
  }

  public async testAIConfig() {
    if (!this.aiApiKey) {
      this.aiTestStatus = 'fail';
      this.aiTestMessage = 'API Key is required';
      return;
    }
    this.aiTesting = true;
    this.aiTestStatus = '';
    this.aiTestMessage = '';
    try {
      const token = cookie.get('token') || localStorage.getItem('token');
      const url = `${origin.urls[0]}/node/ai/analyze`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test connection. Reply with OK.' }],
          apiKey: this.aiApiKey,
          apiUrl: this.aiApiUrl,
          model: this.aiModel,
        }),
      });
      if (!resp.ok) {
        this.aiTestStatus = 'fail';
        this.aiTestMessage = 'HTTP ' + resp.status;
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        this.aiTestStatus = 'fail';
        this.aiTestMessage = 'No response body';
        return;
      }
      const decoder = new TextDecoder();
      let gotContent = false;
      let buffer = '';
      const read = (): Promise<void> => {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            if (!gotContent) {
              this.aiTestStatus = 'fail';
              this.aiTestMessage = 'Empty response from API. Check your model name.';
            }
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const block of lines) {
            const dataLine = block.split('\n').find(l => l.startsWith('data:'));
            if (dataLine) {
              const jsonStr = dataLine.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.delta) {
                  gotContent = true;
                  this.aiTestStatus = 'success';
                  this.aiTestMessage = 'Connection successful!';
                } else if (parsed.error) {
                  this.aiTestStatus = 'fail';
                  this.aiTestMessage = 'API error: ' + parsed.error;
                }
              } catch (e) {
                // ignore
              }
            }
          }
          if (!gotContent && this.aiTestStatus !== 'fail') {
            return read();
          }
        });
      };
      await read();
      if (!gotContent && this.aiTestStatus !== 'fail') {
        this.aiTestStatus = 'fail';
        this.aiTestMessage = 'Empty response from API. Check your model name.';
      }
    } catch (e) {
      this.aiTestStatus = 'fail';
      this.aiTestMessage = (e as any)?.message || 'Connection failed';
    } finally {
      this.aiTesting = false;
    }
  }

  public async saveAIConfig() {
    if (!this.aiConfigName || !this.aiApiKey) {
      this.$plugin && this.$plugin.toast('Name and API Key are required');
      return;
    }
    const payload = {
      name: this.aiConfigName,
      apiUrl: this.aiApiUrl,
      apiKey: this.aiApiKey,
      model: this.aiModel,
      agentPrompt: '',
      isDefault: this.aiIsDefault,
    };
    try {
      if (this.selectedConfigId) {
        await service.updateAIConfig(this.selectedConfigId, payload);
        this.$plugin && this.$plugin.toast('Config updated');
      } else {
        await service.createAIConfig(payload);
        this.$plugin && this.$plugin.toast('Config created');
      }
      await this.loadAIConfigs();
      this.showAIConfig = false;
    } catch (e) {
      this.$plugin && this.$plugin.toast('Save failed: ' + ((e as any)?.message || 'error'));
    }
  }

  public async createRoom() {
    try {
      const roomConfig: any = {
        isShort: this.isShort,
        smallBlind: this.smallBlind,
      };
      // Add Bot/PokerSkill config if enabled
      if (this.enableBots) {
        roomConfig.enableBots = true;
        roomConfig.botCount = Number(this.botCount) || 2;
        roomConfig.enablePokerSkill = this.enablePokerSkill;
        roomConfig.botChips = Number(this.botChips) || 1000;
        if (this.botLlmApiUrl) roomConfig.llmApiUrl = this.botLlmApiUrl;
        if (this.botLlmApiKey) roomConfig.llmApiKey = this.botLlmApiKey;
        if (this.botLlmModel) roomConfig.llmModel = this.botLlmModel;
      }
      const result = await service.createRoom(this.isShort, this.smallBlind, 0, roomConfig);
      const { roomNumber } = result.data;
      localStorage.setItem('roomConfig', JSON.stringify(roomConfig));
      cookie.set('roomConfig', roomConfig, { expires: 1 });
      this.$router.push({ name: 'game', params: { roomNumber, isOwner: '1' } });
    } catch (e) {
      console.log(e);
    }
  }

  public joinRoom() {
    this.isJoin = true;
    this.isHome = false;
  }

  public async go() {
    if (!/^\d+$/.test(this.roomNumber)) {
      this.isError = true;
      return;
    }
    await this.goByRoomNumber(this.roomNumber);
  }

  public async goByEvent(event: any) {
    const roomNumber = event.currentTarget.getAttribute('data-roomNumber');
    await this.goByRoomNumber(roomNumber);
  }

  public async goByRoomNumber(roomNumber: string) {
    try {
      const { data } = await service.findRoom(roomNumber);
      if (data) {
        const roomConfig = { ...data };
        cookie.set('roomConfig', roomConfig, { expires: 1 });
        this.$router.push({ name: 'game', params: { roomNumber } });
      } else {
        this.$plugin.toast('cannot find the room');
        console.log('cannot find the room');
      }
    } catch (e) {
      this.$plugin.toast('cannot find the room');
    }
  }

  public backToHome() {
    this.isJoin = false;
    this.isHome = true;
  }

  public async selfPast7DayGame() {
    try {
      const userIDStr = cookie.get('user_id');
      if (userIDStr) {
        const userID = Number(userIDStr);
        const { data } = await service.selfPast7DayGame(userID);
        data.forEach((v: IGameRecord) => {
          this.gameList.push({ gameId: v.gameId });
        });
        this.currGameIndex = data.length;
        this.commandList = data[data.length - 1].gameCommandList;
        this.showRecord = true;
      }
    } catch (e) {
      console.log(e);
      this.$plugin.toast('cannot find the user command record list');
    }
  }

  public async getRecord(index: number) {
    try {
      console.log('ccc');
      let gameId = 0;
      if (!index) {
        const result = await service.gameRecordList('889008');
        this.gameList = Object.values(result.data);
        gameId = this.gameList[this.gameList.length - 1].gameId;
        this.currGameIndex = this.gameList.length;
        console.log('ccc len', this.gameList.length);
      } else {
        this.currGameIndex = index;
      }
      console.log(gameId, 'ccc11');
      gameId = this.gameList[index].gameId;
      const { data } = await service.commandRecordList('889008', gameId);
      this.commandList = data.commandList;
      this.showRecord = true;
      console.log(data);
    } catch (e) {
      console.log(e);
      this.$plugin.toast('cannot find the room');
    }
  }

  public async getRooms() {
    try {
      const result = await service.getRooms();
      this.rooms = Object.values(result.data);
    } catch (e) {
      console.log('getRooms error: ', e);
    }
  }
}
</script>

<style lang="less" scoped>
.home-container {
  height: 100vh;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: linear-gradient(180deg, var(--bg-primary) 0%, #0a0a0a 100%);
  position: relative;
  overflow: hidden;

  // Subtle background texture using radial gradients
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(212, 175, 55, 0.03) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(212, 175, 55, 0.02) 0%, transparent 40%),
      radial-gradient(ellipse at 50% 80%, rgba(27, 40, 56, 0.4) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  .room-config {
    position: fixed;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    .room-config-shadow {
      position: fixed;
      left: 0; right: 0; bottom: 0; top: 0;
      z-index: 9;
      background-color: rgba(0, 0, 0, 0.5);
    }
    .room-config-body {
      position: relative;
      z-index: 99;
      background: var(--bg-card);
      border: 1px solid var(--border-medium);
      box-shadow: var(--shadow-lg);
      border-radius: var(--radius-lg);
      padding: 28px;
      width: 300px;
      backdrop-filter: blur(12px);

      h1 {
        color: var(--accent-gold);
        font-size: 18px;
        font-weight: 700;
        text-align: center;
        line-height: 40px;
        margin-bottom: 16px;
      }

      .input-bd {
        display: flex;
        align-items: center;
        margin-bottom: 16px;

        .input-name {
          width: 80px;
          text-align: right;
          flex: none;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .input-text {
          margin-left: 12px;
          flex: 1;

          input {
            width: 100%;
            display: inline-block;
            text-align: center;
            vertical-align: middle;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            color: var(--text-primary);
            padding: 8px 12px;
            font-size: 14px;
            box-sizing: border-box;
            transition: var(--transition-fast);

            &:focus {
              outline: none;
              border-color: var(--accent-gold);
            }

            &[type='checkbox'] {
              min-width: auto;
              min-height: auto;
              width: auto;
            }
          }
        }
      }

      .btn {
        margin-top: 8px;

        span {
          display: block;
          text-align: center;
          padding: 12px 0;
          background: linear-gradient(135deg, var(--accent-gold), #c49b2a);
          color: #0a0a0a;
          font-weight: 700;
          font-size: 15px;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-gold);
          transition: var(--transition-normal);
          cursor: pointer;
          letter-spacing: 0.5px;

          &:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-gold-lg);
          }

          &:active {
            transform: translateY(0);
          }
        }
      }
    }
  }

  // AI Config Panel
  .ai-config {
    position: fixed;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    .ai-config-shadow {
      position: fixed;
      left: 0; right: 0; bottom: 0; top: 0;
      z-index: 9;
      background-color: rgba(0, 0, 0, 0.5);
    }
    .ai-config-body {
      position: relative;
      background: linear-gradient(145deg, #0d2e1e, #0a3d28);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 12px;
      z-index: 99;
      width: 380px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px 24px;
      backdrop-filter: blur(12px);
      h1 {
        color: #d4af37;
        font-size: 18px;
        text-align: center;
        margin-bottom: 16px;
      }
      .ai-config-field {
        margin-bottom: 12px;
        label {
          display: block;
          color: rgba(212, 175, 55, 0.7);
          font-size: 12px;
          margin-bottom: 4px;
          .char-count { color: rgba(255,255,255,0.3); font-size: 10px; }
        }
        .preset-btns {
          display: flex;
          gap: 8px;
          .preset-btn {
            flex: 1;
            padding: 8px 4px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(212, 175, 55, 0.2);
            border-radius: var(--radius-sm);
            color: #ccc;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            &:hover { border-color: rgba(212, 175, 55, 0.5); }
            &.active {
              background: rgba(212, 175, 55, 0.15);
              border-color: #d4af37;
              color: #d4af37;
            }
          }
        }
        input, textarea, select {
          width: 100%;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: var(--radius-sm);
          color: #e0e0e0;
          font-size: 13px;
          box-sizing: border-box;
          font-family: inherit;
          transition: var(--transition-fast);
          &:focus { outline: none; border-color: rgba(212, 175, 55, 0.6); }
          &:disabled { opacity: 0.5; }
        }
        textarea { resize: vertical; min-height: 50px; }
        select option { background: #0d2e1e; color: #e0e0e0; }
        .model-input-row {
          display: flex;
          gap: 8px;
          .model-select { width: 45%; flex: none; }
          input { flex: 1; }
        }
        .config-selector {
          display: flex;
          gap: 8px;
          select {
            flex: 1;
            padding: 8px 10px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(212, 175, 55, 0.2);
            border-radius: var(--radius-sm);
            color: #e0e0e0;
            font-size: 13px;
          }
          .btn-icon {
            width: 36px;
            padding: 0;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(212, 175, 55, 0.3);
            border-radius: var(--radius-sm);
            color: #d4af37;
            font-size: 16px;
            cursor: pointer;
            transition: var(--transition-fast);
            &:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
          }
          .btn-danger {
            color: #e8050a;
            border-color: rgba(232, 5, 10, 0.3);
          }
        }
        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 8px;
          color: #ccc !important;
          font-size: 13px !important;
          cursor: pointer;
          input[type='checkbox'] {
            width: auto;
            min-width: auto;
          }
        }
      }
      .ai-config-status {
        text-align: center;
        margin: 8px 0;
        font-size: 13px;
        .status-ok { color: #4caf50; }
        .status-fail { color: #e8050a; }
      }
      .ai-config-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
        button {
          flex: 1;
          padding: 10px 0;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          &:disabled { opacity: 0.5; cursor: not-allowed; }
        }
        .btn-test {
          background: rgba(255,255,255,0.08);
          color: #d4af37;
          border: 1px solid rgba(212, 175, 55, 0.3);
          &:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
        }
        .btn-save {
          background: linear-gradient(135deg, #d4af37, #c49b2a);
          color: #0a0a0a;
          &:hover:not(:disabled) { background: linear-gradient(135deg, #e5c349, #d4af37); }
        }
      }
    }
  }

  .back-to-home {
    background: var(--accent-gold-dim);
    border: 1px solid var(--border-medium);
    color: var(--accent-gold);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    display: inline;
    left: 0;
    position: absolute;
    top: 0;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    z-index: 1;

    &:hover {
      background: var(--accent-gold);
      color: #0a0a0a;
    }
  }

  .room-btn {
    max-width: 600px;
    margin: auto;
    position: relative;
    z-index: 1;

    .welcome-message {
      color: var(--accent-gold);
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
    }

    .btn {
      margin: 16px auto;
      max-width: 320px;

      span {
        display: block;
        text-align: center;
        padding: 14px 28px;
        background: linear-gradient(135deg, var(--accent-gold), #c49b2a);
        color: #0a0a0a;
        font-weight: 700;
        font-size: 16px;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-gold);
        transition: var(--transition-normal);
        letter-spacing: 0.5px;
        cursor: pointer;

        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-gold-lg);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }

    .btn-logout {
      span {
        background: transparent;
        border: 1px solid var(--accent-red);
        color: var(--accent-red);
        box-shadow: none;
        font-weight: 600;

        &:hover {
          background: rgba(231, 76, 60, 0.1);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(231, 76, 60, 0.15);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }
  }

  .room-number {
    line-height: 40px;
    text-align: center;
    width: 100%;
    position: relative;
    z-index: 1;

    p {
      color: var(--text-secondary);
      font-size: 14px;
      margin: 16px 0 8px;
    }

    .error {
      border: 1px solid var(--accent-red) !important;
      box-shadow: 0 0 8px rgba(231, 76, 60, 0.2);
    }

    .input-bd {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.03);
      transition: var(--transition-fast);

      &:focus-within {
        border-color: var(--accent-gold);
        box-shadow: var(--shadow-gold);
      }

      input {
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-primary);
        padding: 8px 12px;

        &::placeholder {
          color: var(--text-muted);
        }
      }
    }

    .room-btn {
      height: 30px;
      margin-top: 0;

      span {
        margin: 0;
        line-height: 30px;
        height: 30px;
        font-size: 12px;
        color: #fff;
        background: linear-gradient(135deg, var(--accent-green), #1e8a4e);
        border-radius: var(--radius-sm);
        padding: 0 20px;
        display: block;
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition-fast);

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(39, 174, 96, 0.25);
        }
      }
    }

    .inline {
      display: inline-block;
      vertical-align: middle;
    }
  }

  table.hot-rooms {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: none;
    margin-top: 8px;

    thead {
      tr {
        background: var(--accent-gold-dim);
        border-bottom: 1px solid var(--border-medium);
      }

      th {
        color: var(--accent-gold);
        font-weight: 600;
        font-size: 13px;
        padding: 10px 12px;
        text-align: left;
        border: none;
        letter-spacing: 0.5px;
      }

      th.hot-room-number {
        width: 25%;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid var(--border-subtle);
        transition: var(--transition-fast);

        &:nth-child(even) {
          background: rgba(255, 255, 255, 0.02);
        }

        &:hover {
          background: rgba(212, 175, 55, 0.06);
        }
      }

      td {
        padding: 10px 12px;
        color: var(--text-secondary);
        font-size: 13px;
        border: none;
        word-wrap: break-word;

        &.hot-room-number {
          color: var(--accent-gold);
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);

          &:hover {
            color: var(--accent-gold-light);
            text-shadow: 0 0 8px rgba(212, 175, 55, 0.3);
          }
        }

        &.hot-room-player {
          word-wrap: break-word;
        }
      }
    }
  }
}
</style>
