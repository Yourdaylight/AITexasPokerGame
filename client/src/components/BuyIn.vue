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
        <div class="btn"><span @click="buyIn">Buy in💴</span></div>
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
    background: rgba(0, 0, 0, 0.2);
  }

  .buy-in-body {
    z-index: 99;
    position: fixed;
    left: 50%;
    top: 50%;
    margin: -100px -150px;
    width: 300px;
    border-radius: 12px;
    box-sizing: border-box;
    background: #fff;
    padding: 20px;
  }

  .input-text {
    input {
      width: 100px;
    }
  }
  .input-name {
    margin-bottom: 15px;
    font-size: 20px;
    text-align: center;
    input {
      width: 70px;
      font-size: 20px;
    }
  }
  .btn {
    margin-top: 20px;
  }
  .small-gray {
  color: gray;
  font-size: 0.8em;
}
}
</style>
