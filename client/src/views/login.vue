<template>
  <div class="login-container container">
    <div class="particles">
      <span v-for="i in 20" :key="i" :style="particleStyle(i)"></span>
    </div>
    <div class="login-body">
      <div class="logo-area">
        <div class="logo-icon">♠♥</div>
        <div class="name">Texas Poker</div>
        <div class="subtitle">Join the Table</div>
      </div>
      <div class="user-name input-bd">
        <div class="input-name iconfont icon-account"></div>
        <div class="input-text">
          <input type="text" v-model="userAccount" placeholder="Account" />
        </div>
      </div>
      <div class="password input-bd">
        <div class="input-name iconfont icon-password"></div>
        <div class="input-text">
          <input type="password" v-model="password" placeholder="Password" />
        </div>
      </div>
      <div class="login-btn btn">
        <span class="btn-gold" @click="login">Sign In</span>
        <b class="btn-outline" @click="signUp">Sign Up</b>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import cookie from 'js-cookie';
import Component from 'vue-class-component';
import { Vue } from 'vue-property-decorator';
import service from '../service';

@Component
export default class Login extends Vue {
  public userAccount: string = '';
  public password: string = '';

  public particleStyle(i: number) {
    const size = Math.random() * 3 + 1;
    return {
      width: size + 'px',
      height: size + 'px',
      left: Math.random() * 100 + '%',
      top: Math.random() * 100 + '%',
      animationDelay: Math.random() * 6 + 's',
      animationDuration: Math.random() * 4 + 4 + 's',
    };
  }

  public signUp() {
    this.$router.replace({ name: 'register' });
    return;
  }

  public async login() {
    try {
      const result = await service.login(this.userAccount, this.password);
      const { token } = result.data;
      cookie.set('token', token, { expires: 1 });
      localStorage.setItem('token', token);
      localStorage.setItem('userAccount', this.userAccount);
      await this.$router.push({ name: 'home' });
    } catch (e) {
      this.$plugin.toast('Wrong password or account.');
    }
  }
}
</script>
<style lang="less" scoped>
.login-container {
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  .particles {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
    span {
      position: absolute;
      background: rgba(212, 175, 55, 0.4);
      border-radius: 50%;
      animation: float linear infinite;
    }
  }

  @keyframes float {
    0% { transform: translateY(0) scale(1); opacity: 0.4; }
    50% { opacity: 0.8; }
    100% { transform: translateY(-100px) scale(0); opacity: 0; }
  }

  .login-body {
    width: 85vw;
    max-width: 420px;
    margin: auto;
    border-radius: 16px;
    box-sizing: border-box;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 60px rgba(212, 175, 55, 0.08);
    background: rgba(20, 20, 35, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(212, 175, 55, 0.2);
    padding: 40px 30px;
    z-index: 1;

    .logo-area {
      text-align: center;
      margin-bottom: 30px;

      .logo-icon {
        font-size: 36px;
        color: #d4af37;
        letter-spacing: 8px;
        margin-bottom: 8px;
      }

      .name {
        font-size: 28px;
        font-weight: 700;
        color: #d4af37;
        letter-spacing: 3px;
        text-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
      }

      .subtitle {
        font-size: 13px;
        color: rgba(212, 175, 55, 0.6);
        margin-top: 6px;
        letter-spacing: 2px;
      }
    }

    .input-bd {
      border: 1px solid rgba(212, 175, 55, 0.25);
      border-radius: 8px;
      margin: 16px auto;
      text-align: left;
      background: rgba(255, 255, 255, 0.03);
      transition: all 0.3s ease;

      &:focus-within {
        border-color: rgba(212, 175, 55, 0.7);
        box-shadow: 0 0 12px rgba(212, 175, 55, 0.15);
        background: rgba(255, 255, 255, 0.05);
      }

      .input-name {
        min-width: 0;
        width: 44px;
        text-align: center;
        font-size: 16px;
        color: rgba(212, 175, 55, 0.6);
      }

      input {
        min-width: 0;
        height: 44px;
        background-color: transparent;
        color: #e0e0e0;
        font-size: 14px;

        &::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }
      }
    }

    .login-btn {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 28px;

      .btn-gold {
        display: block;
        text-align: center;
        padding: 12px 0;
        border-radius: 8px;
        background: linear-gradient(135deg, #d4af37, #c49b2a);
        color: #0a0a0a;
        font-weight: 700;
        font-size: 16px;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);

        &:hover {
          background: linear-gradient(135deg, #e5c349, #d4af37);
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.5);
          transform: translateY(-1px);
        }

        &:active {
          transform: translateY(0);
        }
      }

      .btn-outline {
        display: block;
        text-align: center;
        padding: 12px 0;
        border-radius: 8px;
        border: 1px solid rgba(212, 175, 55, 0.4);
        color: #d4af37;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.08);
        }
      }
    }
  }
}
</style>
