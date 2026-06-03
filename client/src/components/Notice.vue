<template>
  <div class="notice-container">
    <div class="notice-body">
      <i
        v-for="message in messageList"
        v-if="message !== ''"
        :style="{ top: `${message.top}vh`, animationDuration: `${duration}s` }"
      >
        <template v-if="isSpecialMessage(message.message)">
          <!-- message的前两个元素 -->
          {{ message.message.split(':')[0] }}:{{ message.message.split(':')[1] }}
          <cardList :cardList="getCardList(message.message)"  size="mini"></cardList>
        </template>
        <template v-else>
          {{ message.message }}
        </template>
      </i>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

import cardStyle from '@/components/CardStyle.vue';
import Card from './CardList.vue';
@Component({
  components: {
    cardStyle,
    cardList: Card,
  },
})
export default class Notice extends Vue {
  @Prop() public messageList!: any[];
  public duration = 8;

  public resetDuration() {
    const pageWidth = document.documentElement.clientWidth;
    this.duration = pageWidth > 800 ? Math.round((pageWidth / 375) * 4) : Math.round((pageWidth / 375) * 8);
  }

  public mounted() {
    this.resetDuration();
    window.addEventListener('resize', this.resetDuration);
  }

  public beforeDestroy() {
    window.removeEventListener('resize', this.resetDuration);
  }

  get isSpecialMessage() {
    const specialMessageCheck = (msg: string) => {
      //判断msg的开头是否是特殊前缀
      if (typeof msg !== 'string') {
        console.error('Message is not a string:', msg);
        return false;
      }
      //如果根据;分隔的第一个元素是明牌，则返回true
      const isSpecial = msg.split(':')[1].startsWith('明牌');

      console.log(`Message[${msg}] starts with special prefix: ${isSpecial}`);      
      return isSpecial;    
    };    
    return specialMessageCheck;
  }

  // 方法来处理特殊消息并返回卡片列表

  public getCardList(msg: string) {
    const msg_res = msg.split(':')[2].split(',');
    console.log(`Message[${msg_res}] is special message, get card list`);
    return msg_res
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.notice-container {
  .notice-body {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    z-index: 150;
    pointer-events: none;
    i {
      position: absolute;
      top: 20px;
      left: 0;
      transform: translate3d(100vw, 0, 0);
      animation: 8s move linear forwards;
      color: #fff;
      padding: 4px;
      font-size: 12px;
      font-style: normal;
      border-radius: 2px;
      background-color: rgba(0, 0, 0, 0.4);

      @media (min-width: 800px) {
        border-radius: 4px;
        font-size: 16px;
      }
    }
  }
  @-webkit-keyframes move /* Safari 与 Chrome */ {
    0% {
      transform: translate3d(100vw, 0, 0);
    }
    99% {
      transform: translate3d(-198px, 0px, 0px);
      opacity: 1;
    }
    100% {
      transform: translate3d(-200px, 0px, 0px);
      opacity: 0;
    }
  }
}
</style>
