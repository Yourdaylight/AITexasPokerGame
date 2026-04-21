<template>
  <div class="record-container" v-show="show">
    <div class="shadow" @click="show = false"></div>
    <div class="body">
      <div class="title">
        牌局记录
        <span class="close" @click="show = false">X</span>
      <button @click="showTransferScheme()">计算方案</button>
      </div>

      <ul>
        <li class="record-header">
          <i>昵称</i>
          <i>buy in</i>
          <i>counter</i>
          <i>income</i>
          <i>VPIP (V/Total)</i>
          <i>PFR</i>
          <i>翻前胜率</i>
        </li>
        <li v-for="player in players">
          <i>{{ player.nickName }}</i>
          <i>{{ player.buyIn }}</i>
          <i>{{ player.counter }}</i>
          <i>{{ player.counter - player.buyIn }}</i>
          <i v-html="formatVPIP(player)"></i>
          <i v-html="formatPFR(player)"></i>
          <i v-html="formatPreFlopEquity(player)"></i>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { IPlayer } from '@/interface/IPlayer';
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component({
  components: {},
})
export default class Record extends Vue {
  @Prop() public value!: boolean;
  @Prop() public players!: IPlayer[];

  get show() {
    return this.value;
  }

  set show(val) {
    this.$emit('input', val);
  }

  public formatVPIP(player: IPlayer) {
    return this.formatPercentage(player.voluntaryActionCountAtPreFlop, player.actionCountAtPreFlop);
  }

  public formatPFR(player: IPlayer) {
    return this.formatPercentage(player.raiseCountAtPreFlop, player.actionCountAtPreFlop);
  }

  public formatPreFlopEquity(player: IPlayer) {
    return this.formatPercentage(player.winCountAtPreFlop, player.gameCount);
  }

  private formatPercentage(numerator: number, denominator: number) {
    if (denominator === 0 || numerator === 0) {
      return '0%';
    }
    const rate = ((numerator / denominator) * 100).toFixed(2);
    return `${rate}%<br />(${numerator}/${denominator})`;
  }
  // 计算转账方案的方法
  private calculateTransferScheme(players: IPlayer[]): { from: string; to: string; amount: number }[] {
    // 创建玩家数组的深拷贝，并初始化其净收入
    let sortedPlayers = players.map(player => ({
      ...player,
      netIncome: player.counter - player.buyIn // 添加一个新属性来跟踪净收入变化，而不修改原始的buyIn
    })).sort((a, b) => a.netIncome - b.netIncome);

    let transfers: { from: string; to: string; amount: number }[] = [];

    while (sortedPlayers.length > 0) {
      const maxIncomePlayer = sortedPlayers[sortedPlayers.length - 1];
      const minIncomePlayer = sortedPlayers[0];
      const maxIncome = maxIncomePlayer.netIncome;
      const minIncome = minIncomePlayer.netIncome;

      if (maxIncome <= 0 || minIncome >= 0) {
        break;
      }

      const amount = Math.min(maxIncome, -minIncome);
      transfers.push({
        from: minIncomePlayer.nickName,
        to: maxIncomePlayer.nickName,
        amount: amount
      });

      // 更新净收入而不是buyIn
      maxIncomePlayer.netIncome -= amount;
      minIncomePlayer.netIncome += amount;

      // 移除净收入已经调整至0的玩家
      if (maxIncomePlayer.netIncome === 0) {
        sortedPlayers.pop();
      }
      if (minIncomePlayer.netIncome === 0) {
        sortedPlayers.shift();
      }

      // 注意：由于我们修改了对象的netIncome属性，而不是原始的buyIn或counter，因此不需要重新排序。
      // 如果你还需要基于更新后的净收入重新排序，可以取消注释下面的代码。
      // sortedPlayers.sort((a, b) => a.netIncome - b.netIncome);
    }

    return transfers;
  }

  public showTransferScheme() {
    const transfers = this.calculateTransferScheme(this.players);
    const transferStr = transfers.map(transfer => `${transfer.from}向${transfer.to}传输${transfer.amount}`);
    // alert出来
    alert(transferStr.join('\n'));
  }


}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.record-container {
  width: 100vw;
  height: 100vh;
  color: #fff;
  background: #2a2a2a;
  position: absolute;
  left: 0;
  top: 0;
  z-index: 9999;

  .close {
    color: red;
    text-align: right;
    float: right;
  }

  .shadow {
    background: rgba(0, 0, 0, 0.3);
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    position: fixed;
    z-index: 1;
  }

  .body {
    position: relative;
    z-index: 9;
  }

  .title {
    color: #fff;
    text-align: left;
    line-height: 30px;
    padding: 5px 10px;
    border-bottom: 2px solid #fff;
  }

  ul {
    li.record-header {
      font-weight: bold;
    }

    li {
      display: flex;
      border-bottom: 1px solid #c7bc68;

      i {
        flex: 1;
        padding: 5px 10px;
        font-size: 16px;
        line-height: 20px;
        display: inline-block;
        font-style: normal;
        font-size: 12px;
      }
    }
  }
}
</style>
