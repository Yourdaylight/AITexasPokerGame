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
        padding: 2px;
        width: 28px;
        height: 28px;
        display: inline-block;
        font-style: normal;
        font-size: 10px;
        font-weight: bold;
        line-height: 28px;
        border-radius: 50%;
        color: #fff;
        border: 2px solid #f1c40f;
        background: rgba(180, 140, 20, 0.7);
        margin: 6px;
        vertical-align: middle;
        cursor: pointer;

        &:active {
          background: rgba(241, 196, 15, 0.9);
        }
      }
    }

    .action-type {
      white-space: nowrap;
    }

    .action-btn {
      border-radius: 20px;
      min-width: 52px;
      height: 34px;
      padding: 0 12px;
      text-align: center;
      margin: 0 5px;
      line-height: 34px;
      font-size: 12px;
      font-weight: bold;
      display: inline-block;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: transform 0.1s, box-shadow 0.2s;

      &:active {
        transform: scale(0.95);
      }
    }

    .action-btn--fold {
      background: rgba(180, 40, 40, 0.85);
      color: #fff;
      border: 2px solid #e74c3c;
      box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4);
    }

    .action-btn--check {
      background: rgba(30, 130, 76, 0.85);
      color: #fff;
      border: 2px solid #27ae60;
      box-shadow: 0 2px 8px rgba(39, 174, 96, 0.4);
    }

    .action-btn--call {
      background: rgba(30, 130, 76, 0.85);
      color: #fff;
      border: 2px solid #2ecc71;
      box-shadow: 0 2px 8px rgba(46, 204, 113, 0.4);
    }

    .action-btn--raise {
      background: rgba(180, 140, 20, 0.85);
      color: #fff;
      border: 2px solid #f1c40f;
      box-shadow: 0 2px 8px rgba(241, 196, 15, 0.4);
    }

    .action-btn--allin {
      background: rgba(180, 20, 20, 0.9);
      color: #fff;
      border: 2px solid #ff4444;
      box-shadow: 0 0 12px rgba(255, 68, 68, 0.6), 0 0 24px rgba(255, 68, 68, 0.3);
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
      background: linear-gradient(-70deg, black, transparent);
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
          font-size: 20px;
          width: 50px;
          text-align: center;
          color: #fff;
        }
      }

      .btn {
        display: inline-block;
        color: #fff;
        margin-top: 220px;
        border: 2px solid #f1c40f;
        border-radius: 20px;
        background: rgba(180, 140, 20, 0.85);
        padding: 5px 16px;
        font-size: 18px;
        font-weight: bold;
        min-width: 52px;
        height: 34px;
        line-height: 34px;
      }
    }
  }
}

@keyframes allinPulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 68, 68, 0.6), 0 0 24px rgba(255, 68, 68, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 68, 68, 0.8), 0 0 40px rgba(255, 68, 68, 0.5);
  }
}
</style>
