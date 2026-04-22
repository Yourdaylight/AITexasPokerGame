<template>
  <div class="input-container" :class="{ dark: dark }">
    <div class="user-name input-bd" :class="{ move: focus || value !== '', focus: focus, error: error }">
      <div class="input-name">{{ text }}</div>
      <div class="input-text">
        <input :type="type" @focus="onFocus" @blur="focus = false" v-model="changeValue" />
        <i class="iconfont icon-close close" v-show="value !== ''" @click="clear"></i>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class XInput extends Vue {
  @Prop({ default: '', type: String }) public value!: string;
  @Prop({ default: '', type: String }) public text!: string;
  @Prop({ default: 'text', type: String }) public type!: string;
  @Prop({ default: false, type: Boolean }) public error!: boolean;
  @Prop({ default: false, type: Boolean }) public dark!: boolean;

  public focus = false;

  get changeValue() {
    return this.value;
  }

  set changeValue(val: string) {
    this.$emit('input', val);
    this.$emit('change', val);
  }

  public clear() {
    this.$emit('input', '');
  }

  public onFocus() {
    this.focus = true;
    this.$emit('focus');
  }
}
</script>

<style scoped lang="less">
.input-container {
  .input-name {
    top: 12px;
    left: 10px;
    text-align: left;
    padding-left: 2px;
    position: absolute;
    height: 20px;
    line-height: 20px;
    transition: 300ms transform;
    z-index: 0;
    background-color: #fff;
  }

  .input-text {
    position: relative;
    display: block;
    padding: 2px;
    box-sizing: border-box;
    z-index: 1;

    input {
      width: 80vw;
      height: 20px;
      padding: 5px 10px;
      display: inline-block;
      vertical-align: top;
      line-height: 20px;
      background: transparent;
    }
  }

  .input-bd {
    margin: 4vw 0;
    border: 1px solid #bababa;
    border-radius: 4px;
    text-align: left;
    line-height: 40px;
    box-sizing: border-box;
    position: relative;
  }

  .move {
    .input-name {
      transform: translate3d(-10px, -22px, 0px) scale(0.8);
    }
  }

  .focus {
    border: 1px solid #00976e;

    .input-name {
      color: #00976e;
    }
  }

  .error {
    border: 1px solid #e8050a;

    .input-name {
      color: #e8050a;
    }
  }

  .close {
    position: absolute;
    display: inline-block;
    width: 30px;
    height: 30px;
    line-height: 30px;
    text-align: center;
    z-index: 9;
    right: 0;
    top: 8px;
  }

  // Dark mode overrides
  &.dark {
    .input-name {
      background-color: rgba(20, 20, 35, 0.95);
      color: rgba(212, 175, 55, 0.6);
    }

    .input-text input {
      color: #e0e0e0;
    }

    .input-bd {
      border: 1px solid rgba(212, 175, 55, 0.25);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
    }

    .focus {
      border-color: rgba(212, 175, 55, 0.7);
      box-shadow: 0 0 12px rgba(212, 175, 55, 0.15);

      .input-name {
        color: #d4af37;
      }
    }

    .error {
      border-color: #e8050a;

      .input-name {
        color: #e8050a;
      }
    }

    .close {
      color: rgba(212, 175, 55, 0.5);
    }
  }
}
</style>
