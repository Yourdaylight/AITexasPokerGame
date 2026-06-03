<template>
  <div class="action-container">
    <div class="action" v-show="isAction">
      <div class="raise-size">
        <div class="not-allin" v-show="showActionBtn('raise')">
          <i v-for="size in moreSizeMap" @click="raiseOrBet(size)" v-show="showActionSize(size)">
            {{ Math.floor(size) }}
          </i>
        </div>
      </div>
      <div class="action-type">
        <span class="action-btn action-btn--fold" @click="action('fold')">FOLD</span>
        <span class="action-btn action-btn--check" @click="action('check')" v-show="showActionBtn('check')">CHECK</span>
        <span class="action-btn action-btn--call" @click="action('call')" v-show="showActionBtn('call')">CALL</span>
        <span class="action-btn action-btn--raise" @click="otherSizeHandle()" v-show="showActionBtn('raise')">RAISE</span>
        <span class="action-btn action-btn--allin" @dblclick="action('allin')" v-show="!showActionBtn('raise')">
          ALL IN
        </span>
      </div>
    </div>


    <div class="action-other-size" v-if="isRaise">
      <div class="action-other-size-body">
        <div class="size" v-show="currPlayer && moreSize < currPlayer.counter">
          <input type="number" v-model="moreSize" />
        </div>
        <div class="size" v-show="currPlayer && moreSize === currPlayer.counter">Allin</div>
        <range
          :max="currPlayer && currPlayer.counter"
          :min="minActionSize"
          :is-horizontal="true"
          v-model="moreSize"
          @change="getActionSize"
        ></range>
        <div class="btn" @click="addSize">ok</div>
        
      </div>
      <span  class="action-btn action-btn--fold" @click="action('show')">show</span>
      <div class="shadow" @click="isRaise = false"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { IPlayer } from '@/interface/IPlayer';
import * as CustomAudio from '@/utils/audio';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import range from './Range.vue';

@Component({
  components: {
    range,
  },
})
export default class Action extends Vue {
  @Prop() public isAction: boolean = false;
  @Prop() public minActionSize!: number;
  @Prop() public pot!: number;
  @Prop() public prevSize!: number;
  @Prop() public baseSize!: number;
  @Prop() public isPreFlop!: boolean;
  @Prop() public isTwoPlayer!: boolean;
  @Prop() public currPlayer!: IPlayer;
  @Prop() public audioStatus?: boolean;
  @Prop() public maxPot!: number;

  public isRaise = false;
  public moreSize: number = 0;
  public actioned = false;

  @Watch('isAction')
  public wAction(val: boolean) {
    this.actioned = !val;
  }

  @Watch('moreSize')
  public wMoreSize(val: number) {
    this.moreSize = val > this.currPlayer.counter ? this.currPlayer.counter : val;
  }

  get moreSizeMap() {
    let size = this.pot > this.baseSize * 4 ? this.pot : this.baseSize * 2;
    if (this.prevSize > 1) {
      size = this.prevSize * 4;
    }
    return size === this.baseSize * 2
      ? [1 * size, 2 * size, 3 * size, 4 * size]
      : [0.5 * size, 0.75 * size, 1 * size, 2 * size];
  }
  
  get maxRaiseSize() {
    return this.maxPot - this.pot;
  }
  get canActionSize() {
    return Number(this.currPlayer && this.currPlayer.counter + this.currPlayer.actionSize);
  }

  public raiseOrBet(size: number) {
    const actionSize = Math.floor(size);
    if (this.prevSize <= 0) {
      this.action(`bet:${actionSize}`);
    } else {
      this.action(`raise:${actionSize}`);
    }
  }
  public action(command: string) {
    if (!this.actioned) {
      // play the basic custom audio
      if (this.audioStatus) {
        if (command.indexOf('raise') > -1 || command === 'allin' || command === 'call') {
          CustomAudio.playRaise();
        }
        if (command === 'fold' || command === 'check') {
          CustomAudio.playFold();
        }
      }

      this.actioned = true;
      this.$emit('action', command);
      this.isRaise = false;
      this.actioned = false;
    }
  }

  public showActionSize(multiple: number) {
  // 使用maxRaiseSize来限制显示的加注选项
    const potentialPot = Math.floor(multiple * this.pot);
    return (
      this.currPlayer &&
      this.currPlayer.counter > Math.floor(multiple) &&
      potentialPot <= this.maxRaiseSize && // 确保潜在的pot值不会超过最大允许值
      this.baseSize * 2 <= potentialPot
    );
  }

  public otherSizeHandle() {
    this.isRaise = true;
    this.moreSize = this.minActionSize;
  }

  public getActionSize(size: number) {
    if (size > this.minActionSize) {
      this.moreSize = size;
    } else {
      this.$plugin.toast('raise size too small');
    }
  }

  public addSize() {
  // 确保加注大小不超过最大允许的加注大小
  const raiseSize = Math.min(this.moreSize, this.maxRaiseSize);
  if (raiseSize === this.currPlayer?.counter) {
    this.action('allin');
  } else if (this.prevSize <= 0) {
    this.action(`bet:${raiseSize}`);
  } else {
    this.action(`raise:${raiseSize}`);
  }
}
  public showActionBtn(type: string) {
    // check
    if ('check' === type) {
      return (
        this.prevSize <= 0 ||
        (this.isPreFlop && this.isTwoPlayer && this.currPlayer?.type === 'd' && this.prevSize === this.baseSize * 2) ||
        (this.currPlayer?.type === 'bb' && this.prevSize === this.baseSize * 2 && this.isPreFlop)
      );
    }
    // raise
    if ('raise' === type) {
      return this.canActionSize > this.prevSize * 2;
    }
    // call
    if ('call' === type) {
      return (
        this.canActionSize > this.prevSize &&
        this.prevSize > 0 &&
        !(
          (this.isPreFlop &&
            this.isTwoPlayer &&
            this.currPlayer?.type === 'd' &&
            this.prevSize === 2 * this.baseSize) ||
          (this.currPlayer?.type === 'bb' && this.prevSize === 2 * this.baseSize && this.isPreFlop)
        )
      );
    }
    return true;
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.action-container {
  user-select: none;

  .action {
    position: absolute;
    left: 50%;
    bottom: calc(20% + 50px);
    transform: translateX(-50%);
    color: #fff;

    @media (min-height: 800px) {
      top: calc(50% + 70px);
    }

    .raise-size {
      text-align: center;
      white-space: nowrap;

      i {
        width: 36px;
        height: 36px;
        display: inline-block;
        font-style: normal;
        font-size: 11px;
        font-weight: bold;
        line-height: 36px;
        border-radius: 50%;
        color: var(--accent-gold);
        border: 1px solid var(--border-medium);
        background: var(--bg-glass);
        backdrop-filter: blur(4px);
        margin: 6px;
        vertical-align: middle;
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          border-color: var(--accent-gold);
          background: var(--accent-gold-dim);
        }

        &:active {
          transform: scale(0.95);
        }
      }
    }

    .action-type {
      white-space: nowrap;
    }

    .action-btn {
      border-radius: var(--radius-md);
      min-width: 64px;
      height: 40px;
      padding: 0 12px;
      text-align: center;
      margin: 0 5px;
      line-height: 40px;
      font-size: 13px;
      font-weight: bold;
      display: inline-block;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      transition: transform 0.1s, box-shadow 0.2s;
      backdrop-filter: blur(4px);

      &:active {
        transform: scale(0.95);
      }
    }

    .action-btn--fold {
      background: var(--accent-red-bg);
      color: #fff;
      border: 1px solid rgba(231, 76, 60, 0.5);
      box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
    }

    .action-btn--check {
      background: rgba(39, 174, 96, 0.15);
      color: #fff;
      border: 1px solid rgba(39, 174, 96, 0.5);
      box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
    }

    .action-btn--call {
      background: rgba(39, 174, 96, 0.15);
      color: #fff;
      border: 1px solid rgba(39, 174, 96, 0.5);
      box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
    }

    .action-btn--raise {
      background: var(--accent-gold-dim);
      color: #fff;
      border: 1px solid var(--accent-gold-border);
      box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);
    }

    .action-btn--allin {
      background: rgba(231, 76, 60, 0.25);
      color: #fff;
      border: 1px solid var(--accent-red);
      box-shadow: 0 0 8px rgba(231, 76, 60, 0.3);
      animation: allinPulse 1.5s ease-in-out infinite;
    }
  }

  .action-other-size {
    background-color: rgba(0, 0, 0, 0);
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 90;

    .shadow {
      position: absolute;
      width: 100%;
      height: 100%;
      z-index: 8;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    }

    .action-other-size-body {
      z-index: 9;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(0, -50%);
      text-align: center;

      .size {
        input {
          background: transparent;
          border: none;
          border-bottom: 2px solid var(--border-medium);
          color: var(--accent-gold);
          font-size: 24px;
          font-weight: 700;
          width: 80px;
          text-align: center;
          outline: none;
          transition: border-color var(--transition-fast);

          &:focus {
            border-bottom-color: var(--accent-gold);
          }
        }
      }

      .btn {
        display: inline-block;
        color: #0a0a0a;
        margin-top: 220px;
        border: 1px solid var(--accent-gold-border);
        border-radius: var(--radius-full);
        background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-light) 100%);
        padding: 8px 24px;
        font-size: 16px;
        font-weight: 700;
        min-width: 64px;
        line-height: 24px;
        cursor: pointer;
        box-shadow: var(--shadow-gold);
        transition: transform var(--transition-fast), box-shadow var(--transition-fast);

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(212, 175, 55, 0.35);
        }

        &:active {
          transform: scale(0.97);
        }
      }
    }
  }
}

@keyframes allinPulse {
  0%, 100% {
    box-shadow: 0 0 8px rgba(231, 76, 60, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(231, 76, 60, 0.5);
  }
}
</style>
