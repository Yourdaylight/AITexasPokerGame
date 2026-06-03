<template>
  <div class="sit-list-container" ref="container">
    <div class="indicator" :style="indicatorStyle" v-if="actionUserId"></div>
    <div class="sit-list">
      <div class="sit" v-for="(sit, key) in sitList" :key="key" @click="sitDown(sit)">
        <div class="default" v-show="!sit.player">
          <i>sit</i>
        </div>
        <div class="sit-number">NO.{{ sit.position }}</div>
        <div class="sit-player" v-if="sit.player">
          <div class="player" :class="{ fold: sit.player.status === -1 }" :data-player-id="sit.player.userId">
            <div class="count-down" v-show="actionUserId === sit.player.userId">{{ time }}</div>
            <div class="user-name" v-show="sit.player.nickName">
              {{ sit.player.nickName }}
            </div>
            <div class="icon iconfont icon-user-avatar"></div>
            <span
              v-show="playersStatus[sit.player.userId] && playersStatus[sit.player.userId].speaking"
              class="speaking-icon"
            >
              Speak🎙️
            </span>
            <div
              class="counter"
              :class="{
                isAction: actionUserId === sit.player.userId,
                'close-time-out': time > 0 && time < 10 && actionUserId === sit.player.userId,
              }"
              v-show="sit.player.counter >= 0 || sit.player.actionCommand === 'allin'"
            >
              {{ sit.player.counter || 0 }}
            </div>
            <div class="action-size" v-show="sit.player.actionSize > 0">
              {{ sit.player.actionSize }}
            </div>
            <div class="action-command" v-show="sit.player.actionCommand">
              {{ sit.player.actionCommand }}
            </div>
            <div class="position-label" v-show="sit.player.type" :class="'position-label--' + sit.player.type">
              {{ positionLabel(sit.player.type) }}
            </div>
            <div
              class="hand-card"
              v-show="
              !!!currPlayer ||
                  (sit.player.userId !== currPlayer.userId && sit.player.handCard && sit.player.handCard.length !== 0)
              "
            >
              <cardList :cardList="sit.player.handCard" :valueCards="valueCards"></cardList>
            </div>
            <div
              class="card-style"
              v-show="
                !!!currPlayer ||
                  (sit.player.userId !== currPlayer.userId && sit.player.handCard && sit.player.handCard.length !== 0)
              "
            >
              {{ PokeStyle(sit.player.handCard) }}
            </div>
          </div>
          <!-- 展示当前客户端用户的手牌 -->
          <div class="cards" v-show="showHandCard(sit)">
            <div class="hand-card">
              <cardList :cardList="handCard" :valueCards="valueCards"></cardList>
              <div
                class="delay-time"
                v-show="time < 15 && sit.player.delayCount > 0 && actionUserId === sit.player.userId"
                @click="delayTime"
              >
                <i class="iconfont icon-clock "></i>
                <span>Delay Count{{ sit.player.delayCount }}</span>
              </div>
            </div>
            <div class="ready" v-show="handCard && handCard.length === 0">ready</div>
            <div class="card-style" v-if="commonCard && commonCard.length > 0">{{ PokeStyle() }}</div>
          </div>
          <div class="win" v-show="sit.player.income">
            <!--            <span>win!</span>-->
            <span>{{ `+${sit.player.income}` }}</span>
          </div>
        </div>
      </div>
    </div>
    <BuyIn :showBuyIn.sync="showBuyIn" v-model="buyInSize" @buyIn="buyIn"></BuyIn>
  </div>
</template>

<script lang="ts">
import BuyIn from '@/components/BuyIn.vue';
import { IPlayer } from '@/interface/IPlayer';
import { IPlayersStatus } from '@/interface/IPlayersStatus';
import { IRoom } from '@/interface/IRoom';
import ISit from '@/interface/ISit';
import { ILinkNode } from '@/utils/Link';
import { PokerStyle } from '@/utils/PokerStyle';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import map from '../utils/map';
import cardList from './CardList.vue';

@Component({
  components: {
    cardList,
    BuyIn,
  },
})
export default class SitList extends Vue {
  @Prop() public msg!: string;
  @Prop() public currPlayer!: IPlayer;
  @Prop() public commonCard!: string[];
  @Prop() public sitLink!: ILinkNode<ISit>;
  @Prop() public handCard!: string[];
  @Prop() public winner!: IPlayer[][];
  @Prop() public isPlay!: boolean;
  @Prop() public roomConfig!: IRoom;
  @Prop() public actionUserId!: string;
  @Prop() public valueCards!: string;
  @Prop({ default: 45, type: Number }) public time!: number;
  @Prop() public playersStatus!: IPlayersStatus;
  @Prop() public buyInSize!: number;

  public sitLinkNode: any = '';
  public showBuyIn = false;
  public currSit!: ISit;

  @Watch('sitLink')
  public getSit(val: ILinkNode<ISit>) {
    this.sitLinkNode = val;
  }

  public buyIn(size: number) {
    this.showBuyIn = false;
    this.$emit('buyIn', Number(size), () => {
      this.currPlayer.counter += Number(size);
      this.sitDown(this.currSit);
    });
  }

  public showHandCard(sit: ISit) {
    return sit.player?.userId === this.currPlayer?.userId;
  }

  public positionLabel(type: string) {
    const labels: Record<string, string> = {
      d: 'D',
      sb: 'SB',
      bb: 'BB',
    };
    return labels[type] || type;
  }

  public PokeStyle(cards: string[]) {
    if (this.commonCard.length === 0) {
      return '';
    }
    const commonCard = this.commonCard || [];
    let handCard = this.handCard || [];
    if (cards) {
      handCard = cards;
    }
    const card = [...handCard, ...commonCard];
    const style = new PokerStyle(card, this.roomConfig.isShort);
    return style.getPokerStyleName();
  }

  get handCardString() {
    return this.mapCard(this.handCard);
  }

  get hasSit() {
    return !!this.sitList.find((s) => s.player && s.player.userId === this.currPlayer?.userId);
  }

  get indicatorStyle() {
    const { actionUserId, sitLink } = this;

    if (actionUserId && sitLink) {
      const computeIndicatorStyle = (targetEl: HTMLDivElement, containerEl: HTMLDivElement) => {
        if (targetEl) {
          const { left, top, width, height } = targetEl.getBoundingClientRect();
          const containerRect = containerEl.getBoundingClientRect();
          const targetX = left + width / 2;
          const targetY = top + height / 2;
          const centerX = containerRect.left + containerRect.width / 2;
          const centerY = containerRect.top + containerRect.height / 2;
          const indicatorWidth = Math.sqrt(Math.abs(targetX - centerX) ** 2 + Math.abs(targetY - centerY) ** 2);
          let degree = (Math.asin(Math.abs(targetY - centerY) / indicatorWidth) * 180) / Math.PI;

          if (targetX >= centerX && targetY < centerY) {
            degree = 360 - degree;
          } else if (targetX < centerX && targetY < centerY) {
            degree += 180;
          } else if (targetX < centerX && targetY >= centerY) {
            degree = 180 - degree;
          }

          return {
            width: indicatorWidth + 'px',
            transform: `rotate3D(0, 0, 1, ${degree}deg)`,
          };
        }
      };

      const containerElement = this.$refs.container as HTMLDivElement;
      const playerElement = containerElement?.querySelector<HTMLDivElement>(`[data-player-id="${actionUserId}"]`);

      if (playerElement) {
        return computeIndicatorStyle(playerElement, containerElement);
      }
    }

    return null;
  }

  public mapCard(cards: string[]) {
    return map(cards);
  }

  public delayTime() {
    if (this.currPlayer.delayCount > 0) {
      // this.$emit('update:time', this.time  + 60);
      this.$emit('delay');
    }
  }

  public sitDown(sit: ISit) {
    if (!sit.player && (!this.isPlay || !this.hasSit)) {
      if (this.currPlayer.counter <= 0) {
        this.showBuyIn = true;
        this.currSit = sit;
        return;
      }
      // Check if player stood up during this game (seat-change penalty)
      if (this.currPlayer.hasStoodUp && this.isPlay) {
        // If sitting back at the original position, no penalty
        if (this.currPlayer.lastPosition === sit.position) {
          // Proceed normally without penalty
        } else {
          const otherSeatedCount = this.sitList.filter(
            (s) => s.player && s.player.userId !== this.currPlayer?.userId && s.player.counter > 0
          ).length;
          const totalPenalty = otherSeatedCount * 50;
          if (this.currPlayer.counter < totalPenalty) {
            this.showBuyIn = true;
            this.currSit = sit;
            return;
          }
          const confirmed = confirm(`换座需要向其他${otherSeatedCount}位玩家各支付50积分（共${totalPenalty}积分），确认坐下？`);
          if (!confirmed) {
            // If cancelled and original seat is empty, automatically sit back
            if (this.currPlayer.lastPosition !== undefined && this.currPlayer.lastPosition !== sit.position) {
              const originalSit = this.sitList.find((s) => s.position === this.currPlayer?.lastPosition);
              if (originalSit && !originalSit.player) {
                this.sitDown(originalSit);
              }
            }
            return;
          }
        }
      }
      let sitNode = this.sitLinkNode;
      for (let i = 0; i < 10; i++) {
        if (sitNode) {
          const next = sitNode.next;
          if (sitNode.node.player?.nickName === this.currPlayer?.nickName) {
            delete sitNode.node.player;
          }
          sitNode = next as ILinkNode<ISit>;
        }
      }
      for (let i = 0; i < 10; i++) {
        if (sitNode) {
          const next = sitNode.next;
          if (sit.position === sitNode.node.position) {
            sitNode.node.player = this.currPlayer as IPlayer;
            this.$emit('update:sitLink', sitNode);
            this.$emit('sit', sitNode);
            break;
          }
          sitNode = next as ILinkNode<ISit>;
        }
      }
    }
  }

  get sitList() {
    const sitMap: ISit[] = [];
    if (this.sitLinkNode) {
      let link = this.sitLinkNode;
      for (let i = 0; i < 10; i++) {
        if (link.node.player && link.node.player.userId === this.currPlayer?.userId) {
          this.sitLinkNode = link;
          break;
        }
        const next = link.next;
        link = next as ILinkNode<ISit>;
      }
      let sitNode = this.sitLinkNode;
      for (let i = 0; i < 10; i++) {
        const next = sitNode.next;
        sitMap.push(sitNode.node);
        sitNode = next as ILinkNode<ISit>;
      }
      console.log('sit', sitMap);
      return sitMap;
    }
    return [];
  }

  public mounted() {
    this.sitLinkNode = this.sitLink;
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.sit-list-container {
  position: relative;
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  height: 100%;
  width: 100vw;
  user-select: none;

  .indicator {
    position: absolute;
    left: 50%;
    top: 50%;
    height: 180px;
    margin-top: -90px;
    background-image: linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.25) 60%, transparent);
    clip-path: polygon(0 50%, 100% 0, 100% 100%, 0 50%);
    transform-origin: left center;
    pointer-events: none;

    @media (max-height: 680px) {
      height: 100px;
      margin-top: -50px;
    }
  }

  .sit-list {
    position: relative;
    width: 100vw;
    height: 100%;
    max-width: 800px;
    max-height: 800px;
    padding: 10px;
    margin: auto;
    box-sizing: border-box;

    .sit-number {
      position: absolute;
      top: -14px;
      left: 0;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(0, 0, 0, 0.4);
      padding: 1px 5px;
      border-radius: 3px;
      white-space: nowrap;
      letter-spacing: 0.3px;
      z-index: 2;
    }

    .sit {
      position: absolute;
      font-size: 12px;
      z-index: 1;

      @media (min-width: 800px) and (min-height: 800px) {
        transform: scale(1.25);
        transform-origin: left bottom;
      }

      .default {
        i {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1px dashed var(--border-medium);
          display: block;
          font-style: normal;
          font-size: 20px;
          line-height: 52px;
          color: var(--text-muted);
          background: var(--bg-glass);
          backdrop-filter: blur(4px);
          transition: all var(--transition-fast);

          &:hover {
            border-color: var(--accent-gold);
            color: var(--accent-gold);
          }
        }
      }

      .player {
        width: 52px;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;

        .icon {
          width: 52px;
          height: 52px;
          font-size: 45px;
          line-height: 52px;
          border-radius: 50%;
          margin-bottom: 4px;
          background: linear-gradient(135deg, #1a2a3a, #2a3a4a);
          border: 2px solid var(--border-subtle);
          box-shadow: var(--shadow-sm);
          color: var(--accent-gold);
          order: -1; /* Move avatar above user-name */
        }

        .speaking-icon {
          font-size: 18px;
          position: absolute;
          top: 45px;
          left: 0;
        }

        .user-name {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 1px 1px 2px black;
          text-align: center;
          width: 100%;
          line-height: 1.3;
          margin-bottom: 2px;
        }

        .count-down {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          position: absolute;
          left: 0;
          top: 18px;
          bottom: 18px;
          color: var(--accent-gold);
          font-weight: 700;
          font-size: 22px;
          background: linear-gradient(0deg, rgba(0, 0, 0, 0.4), transparent);
          z-index: 2;
        }

        .counter {
          background: var(--bg-glass);
          backdrop-filter: blur(4px);
          border-radius: var(--radius-sm);
          padding: 2px 6px;
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
          font-weight: 600;
          font-size: 11px;
          text-align: center;
          white-space: nowrap;

          &.isAction {
            box-shadow: 0px 0px 6px 4px;
          }

          &.close-time-out {
            animation: 300ms timeOut infinite;
          }
        }

        .action-command {
          top: 20px;
          left: calc(100% + 2px);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 600;
          text-shadow: 1px 2px 3px rgba(0, 0, 0, 0.3);
          position: absolute;
          white-space: nowrap;
          z-index: 3;
        }

        .card-style {
          color: #fff;
          margin-top: 4px;
          font-size: 11px;
          text-align: center;
        }

        .position-label {
          position: absolute;
          left: calc(100% + 2px);
          top: 78px;
          border-radius: var(--radius-sm);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 5px;
          line-height: 14px;
          letter-spacing: 0.5px;
          white-space: nowrap;
          z-index: 3;
        }

        .position-label--d {
          background: var(--accent-gold);
          color: #0a0a0a;
        }

        .position-label--sb {
          background: var(--accent-blue);
          color: #fff;
        }

        .position-label--bb {
          background: var(--accent-orange);
          color: #fff;
        }

        .action-size {
          background: var(--accent-gold-dim);
          border: 1px solid var(--accent-gold-border);
          border-radius: var(--radius-sm);
          padding: 2px 8px;
          text-align: center;
          color: var(--accent-gold);
          font-weight: 700;
          font-size: 11px;
          position: absolute;
          left: calc(100% + 2px);
          top: 56px;
          min-width: 30px;
          box-sizing: border-box;
          white-space: nowrap;
          z-index: 3;
        }

        &.fold {
          opacity: 0.4;
        }
      }

      .delay-time {
        position: absolute;
        top: 0;
        left: 120px;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 150;
        background: radial-gradient(rgba(0, 0, 0, 0.5), transparent 70%);

        i {
          color: var(--accent-gold);
          font-size: 40px;
        }

        span {
          font-size: 25px;
          color: #fff;
          margin-left: 2px;
          font-weight: 600;
        }
      }

      .hand-card {
        position: absolute;
        left: 0;
        top: 18px;
      }

      &:nth-child(1) {
        left: 50%;
        top: 80%;
        margin-left: -90px;

        .action-command {
          left: unset;
          right: calc(100% + 2px);
          top: 20px;
        }

        .position-label {
          left: unset;
          right: calc(100% + 2px);
          top: 78px;
        }

        .action-size {
          top: 56px;
          left: unset;
          right: calc(100% + 2px);
          min-width: 30px;
          padding: 2px 8px;
          text-align: center;
        }
      }

      &:nth-child(2) {
        left: 10px;
        top: 65%;
      }

      &:nth-child(3) {
        left: 10px;
        top: 45%;
      }

      &:nth-child(4) {
        left: 10px;
        top: 25%;
      }

      &:nth-child(5) {
        left: 10px;
        top: 40px;
      }

      &:nth-child(6) {
        right: 45%;
        top: 40px;
      }

      &:nth-child(7) {
        right: 10px;
        top: 40px;
      }

      &:nth-child(8) {
        right: 10px;
        top: 25%;
      }

      &:nth-child(9) {
        right: 10px;
        top: 45%;
      }

      &:nth-child(10) {
        right: 10px;
        top: 65%;
      }

      &:nth-child(6),
      &:nth-child(7),
      &:nth-child(8),
      &:nth-child(9),
      &:nth-child(10) {
        .action-command {
          left: unset;
          right: calc(100% + 2px);
          top: 20px;
        }

        .position-label {
          left: unset;
          right: calc(100% + 2px);
          top: 78px;
        }

        .action-size {
          left: unset;
          right: calc(100% + 2px);
          top: 56px;
          padding: 2px 8px;
          text-align: right;
        }

        .hand-card {
          left: unset;
          right: 0;
        }

        .card-style {
          min-width: 100%;
          float: right;
        }
      }

      .cards {
        position: absolute;
        left: calc(100% + 20px);
        top: 5px;

        .ready {
          font-size: 14px;
          display: inline-block;
          vertical-align: middle;
        }

        .card-style {
          position: absolute;
          color: #fff;
          font-size: 14px;
          line-height: 1;
          top: 84px;
          text-align: center;
          font-weight: 700;
        }
      }

      .win {
        position: absolute;
        z-index: 8;
        left: 0;
        top: 4vh;
        font-size: 22px;
        color: var(--accent-gold);
        font-weight: 600;
        text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
        animation: fadeOut 4s forwards;
        background-image: linear-gradient(to top, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0));
      }
    }
  }

  @-webkit-keyframes fadeOut /* Safari 与 Chrome */ {
    0% {
      transform: translate3d(2px, 0, 0);
      opacity: 1;
    }
    30% {
      transform: translate3d(2px, 0, 0);
      opacity: 1;
    }
    to {
      transform: translate3d(2px, -15px, 0);
      opacity: 0;
    }
  }

  @-webkit-keyframes timeOut /* Safari 与 Chrome */ {
    0% {
      box-shadow: none;
    }
    100% {
      box-shadow: 0px 0px 6px 4px;
    }
  }
}
</style>
