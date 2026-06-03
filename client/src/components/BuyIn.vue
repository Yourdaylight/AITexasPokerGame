<template>
  <Transition name="fade">
    <div class="buy-in" v-show="showBuyIn">
      <div class="shadow" @click="closeBuyIn"></div>
      <div class="buy-in-body">
        <div class="input-bd">
          <div class="input-name">
            <span>buy in:&nbsp;</span>
            <input v-model="value" />
          </div>
        </div>
        <div class="btn"><span @click="buyIn">Buy In</span></div>
        <div class="hint-text small-gray">
          游戏开始后，筹码小于 {{maxBuyInFactor}} 的一半时才可买入.
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import range from './Range.vue';
import { MaxBuyInFactor} from '@/utils/constant';
@Component({
  components: {
    range,
  },
})
export default class BuyIn extends Vue {
  @Prop() public showBuyIn!: boolean;
  @Prop() public value!: any;
  public maxBuyInFactor = MaxBuyInFactor;

  public closeBuyIn() {
    this.$emit('update:showBuyIn', false);
  }

  public async buyIn() {
    this.closeBuyIn();
    this.$emit('buyIn', Number(this.value));
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.buy-in {
  position: fixed;
  z-index: 99;

  .shadow {
    position: fixed;
    z-index: 9;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
  }

  .buy-in-body {
    z-index: 99;
    position: fixed;
    left: 50%;
    top: 50%;
    margin: -120px -160px;
    width: 320px;
    background: var(--bg-card);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-medium);
    box-shadow: var(--shadow-md);
    border-radius: var(--radius-lg);
    padding: 32px;
    box-sizing: border-box;
  }

  .input-name {
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    text-align: center;

    input {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: var(--accent-gold);
      font-size: 24px;
      font-weight: 700;
      padding: 8px 12px;
      width: 100px;
      text-align: center;

      &:focus {
        border-color: var(--accent-gold);
        outline: none;
      }
    }
  }

  .btn {
    margin-top: 20px;

    span {
      display: block;
      text-align: center;
      padding: 12px 0;
      background: linear-gradient(135deg, var(--accent-gold), #c49b2a);
      color: #0a0a0a;
      font-weight: 700;
      font-size: 15px;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: var(--transition-normal);
    }
  }

  .small-gray {
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
    margin-top: 12px;
  }
}
</style>
