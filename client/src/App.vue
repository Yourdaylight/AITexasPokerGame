<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script lang="ts">
import { Vue } from 'vue-property-decorator';

export default class App extends Vue {}
</script>

<style lang="less">
@import 'assets/less/base';
@import 'assets/global.css';
@import '~animate.css';

#app {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-primary);
  background: var(--bg-primary);
  min-height: 100vh;
  overflow: hidden;
  margin: auto;
  height: 100%;
}

* {
  padding: 0;
  margin: 0;
}

html,
body {
  box-sizing: border-box;
  height: 100%;
}

.container {
  .input-bd {
    line-height: 36px;
    margin: 12px 10px;
    font-size: 0;

    .input-name {
      display: inline-block;
      min-width: 10vw;
      font-size: 14px;
      vertical-align: middle;
      color: var(--text-secondary);
    }

    .input-text {
      display: inline-block;
      font-size: 14px;
      vertical-align: middle;

      input {
        min-height: 36px;
        padding: 0 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        color: var(--text-primary);
        font-family: var(--font-sans);
        font-size: 14px;
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

        &:focus {
          border-color: var(--accent-gold-border);
          box-shadow: 0 0 0 3px var(--accent-gold-dim);
        }

        &::placeholder {
          color: var(--text-muted);
        }
      }
    }
  }

  .btn {
    margin-top: 15px;

    span {
      color: var(--bg-primary);
      background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-light) 100%);
      border-radius: var(--radius-sm);
      padding: 8px 24px;
      display: block;
      margin: 10px;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      cursor: pointer;
      box-shadow: var(--shadow-gold);
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);

      &:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-gold-lg);
      }

      &:active {
        transform: translateY(0);
      }
    }

    b {
      display: inline-block;
      border: aliceblue;
      font-size: 12px;
      border-radius: 8px;
      padding: 5px 20px;
      margin-left: 10px;
    }
  }
}
</style>
