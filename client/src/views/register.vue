<template>
  <div class="register-container container">
    <div class="particles">
      <span v-for="i in 15" :key="i" :style="particleStyle(i)"></span>
    </div>
    <div class="register-body">
      <div class="logo-area">
        <div class="logo-icon">♠♥</div>
        <div class="title">Create Account</div>
      </div>
      <div class="user-name">
        <XInput v-model="form.userAccount" text="account" @focus="removeValid('userAccount')"
          :error="errorData.indexOf('userAccount') > -1" dark></XInput>
      </div>
      <div class="user-name">
        <XInput v-model="form.nickName" text="nickName" @focus="removeValid('nickName')"
          :error="errorData.indexOf('nickName') > -1" dark></XInput>
      </div>
      <div class="password">
        <XInput v-model="form.password" text="password" type="password" @focus="removeValid('password')"
          :error="errorData.indexOf('password') > -1" dark></XInput>
      </div>
      <div class="confirm">
        <XInput v-model="form.confirm" text="confirm" type="password" @focus="removeValid('confirm')"
          :error="errorData.indexOf('confirm') > -1" dark></XInput>
      </div>
      <div class="user-email">
        <XInput v-model="form.email" text="email" @focus="removeValid('email')"
          :error="errorData.indexOf('email') > -1" dark></XInput>
      </div>
      <div class="email-verification-code">
        <XInput v-model="form.code" text="验证码" @focus="removeValid('code')"
          :error="errorData.indexOf('code') > -1" dark></XInput>
      </div>
      <div class="register-btn">
        <button class="btn-code" @click="getcode" :disabled="isEmailCodeSent && countdown > 0">
          {{ isEmailCodeSent ? `Resend (${countdown}s)` : 'Get Code' }}
        </button>
        <div class="s-btn"><span class="btn-gold" @click="register">Submit</span></div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import Component from 'vue-class-component';
import { Vue } from 'vue-property-decorator';
import toast from '../components/Toast.vue';
import XInput from '../components/XInput.vue';
import service from '../service';

@Component({
  components: {
    toast,
    XInput,
  },
})
export default class Register extends Vue {
  public form: any = {
    userAccount: '',
    nickName: '',
    password: '',
    confirm: '',
    email: '',
    code: '',
  };
  public errorData: string[] = [];
  public isEmailCodeSent = false;
  public countdown = 0;
  private countdownTimer: any = null;

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

  private startCountdown() {
    this.countdownTimer = setInterval(() => {
      if (this.countdown > 0) {
        this.countdown--;
      } else {
        this.isEmailCodeSent = false;
        clearInterval(this.countdownTimer);
      }
    }, 1000);
  }

  public valid() {
    const errorArr: string[] = [];
    for (const formKey in this.form) {
      if (this.form[formKey] === '') {
        errorArr.push(formKey);
      }
    }
    if (this.form.password !== this.form.confirm) {
      errorArr.push('confirm');
      errorArr.push('password');
    }
    const supported_emails = ['qq.com', '163.com', '126.com', 'sina.com', 'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];
    if (this.form.email.indexOf('@') === -1) {
      errorArr.push('email');
    } else {
      const emailSuffix = this.form.email.split('@')[1];
      if (!supported_emails.includes(emailSuffix)) {
        errorArr.push('email');
      }
    }
    if (this.form.code.length !== 6 || isNaN(Number(this.form.code))) {
      errorArr.push('code');
    }
    this.errorData = errorArr;
  }

  public removeValid(validName: string) {
    this.errorData = this.errorData
      .join(',')
      .replace(validName, '')
      .split(',');
  }

  public async register() {
    try {
      this.valid();
      if (this.errorData.join('') === '') {
        await service.register(this.form);
        this.$plugin.toast('注册成功！等待管理员审核后可登陆');
        setTimeout(() => {
          this.$router.replace({ name: 'login' });
        }, 2000);
      }
    } catch (e) {
      this.$plugin.toast(JSON.stringify(e));
    }
  }

  public async getcode() {
    try {
      if (!this.form.email) {
        this.errorData.push('email');
        return;
      }
      await service.sendEmailVerificationCode(this.form.email);
      this.isEmailCodeSent = true;
      this.countdown = 60;
      this.startCountdown();
      this.$plugin.toast('Verification code sent to your email.');
    } catch (e) {
      this.$plugin.toast(JSON.stringify(e));
    }
  }
}
</script>
<style lang="less" scoped>
.register-container {
  background: linear-gradient(135deg, #0a0a0a 0%, #0a3d28 50%, #0d2e1e 100%);
  min-height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  padding: 20px;
  position: relative;
  overflow: hidden;

  .particles {
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
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

  .register-body {
    max-width: 420px;
    margin: 20px auto;
    border-radius: 16px;
    box-sizing: border-box;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 60px rgba(212, 175, 55, 0.08);
    background: rgba(20, 20, 35, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(212, 175, 55, 0.2);
    padding: 30px;
    position: relative;
    z-index: 1;

    .logo-area {
      text-align: center;
      margin-bottom: 20px;

      .logo-icon {
        font-size: 28px;
        color: #d4af37;
        letter-spacing: 8px;
        margin-bottom: 4px;
      }

      .title {
        font-size: 22px;
        font-weight: 700;
        color: #d4af37;
        letter-spacing: 2px;
      }
    }

    .register-btn {
      width: 100%;
      margin-top: 16px;

      .btn-code {
        width: 100%;
        padding: 10px 0;
        border-radius: 8px;
        border: 1px solid rgba(212, 175, 55, 0.4);
        background: transparent;
        color: #d4af37;
        font-size: 13px;
        cursor: pointer;
        margin-bottom: 12px;
        transition: all 0.3s ease;

        &:hover:not(:disabled) {
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.08);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

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
      }
    }
  }
}
</style>
