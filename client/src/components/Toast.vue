<template>
  <div class="toast-container">
    <div class="toast-body" v-show="showValue">
      <span class="toast-icon">&#x1F4AC;</span>
      <span class="toast-text">{{ text }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class Toast extends Vue {
  @Prop() public text!: string;
  @Prop({ default: false, type: Boolean }) public show!: boolean;
  @Prop({ default: 3000, type: Number }) public timeOut!: number;

  public Time: any;

  get showValue() {
    console.log('come in1111', this.show);
    if (this.show) {
      this.close();
    }
    return this.show;
  }

  set showValue(val) {
    this.$emit('update:show', val);
  }

  public close() {
    console.log('come in');
    clearTimeout(this.Time);
    this.Time = setTimeout(() => {
      this.showValue = false;
      this.$emit('close');
    }, this.timeOut || 0);
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.toast-container {
  .toast-body {
    padding: 12px 20px;
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    text-align: center;
    color: var(--text-primary);
    font-size: 14px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate3d(-50%, -50%, 0);
    line-height: 1.5;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 280px;

    .toast-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .toast-text {
      font-weight: 500;
    }
  }
}
</style>
