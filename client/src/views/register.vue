<template>
  <div class="register-container container">
    <div class="register-body">
      <div class="logo">D Z P</div>
      <div class="title">Create Account</div>
      <div class="user-name">
        <XInput v-model="form.userAccount" text="account" @focus="removeValid('userAccount')"
          :error="errorData.indexOf('userAccount') > -1"></XInput>
      </div>
      <div class="user-name">
        <XInput v-model="form.nickName" text="nickName" @focus="removeValid('nickName')"
          :error="errorData.indexOf('nickName') > -1"></XInput>
      </div>
      <div class="password">
        <XInput v-model="form.password" text="password" type="password" @focus="removeValid('password')"
          :error="errorData.indexOf('password') > -1"></XInput>
      </div>
      <div class="confirm">
        <XInput v-model="form.confirm" text="confirm" type="password" @focus="removeValid('confirm')"
          :error="errorData.indexOf('confirm') > -1"></XInput>
      </div>
      <!-- 加上邮箱和邮箱验证码-->
      <div class="user-email">
        <XInput v-model="form.email" text="email" @focus="removeValid('email')"
          :error="errorData.indexOf('email') > -1"></XInput>
      </div>

      <!-- 获取邮箱验证码的按钮 -->
      <div class="email-verification-code">
        <!-- 验证码输入框 -->
        <XInput v-model="form.code" text="验证码" @focus="removeValid('code')"
          :error="errorData.indexOf('code') > -1">
        </XInput>
      </div>

      <div class="register-btn">
        <button @click="getcode" :disabled="isEmailCodeSent && countdown > 0" style="overflow: auto;">
          {{ isEmailCodeSent ? `Resend (${countdown}s)` : 'Get Verification Code' }}
        </button>
        <div class="s-btn btn"><span @click="register">submit</span></div>
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
  public isEmailCodeSent = false; // 标记验证码是否已发送  
  public countdown = 0; // 倒计时剩余时间  
  private countdownTimer: any = null; // 用于存储倒计时定时器  
  private startCountdown() {
    this.countdownTimer = setInterval(() => {
      if (this.countdown > 0) {
        this.countdown--;
      } else {
        this.isEmailCodeSent = false; // 倒计时结束，允许重新发送验证码  
        clearInterval(this.countdownTimer); // 清除定时器  
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
    // confirm password
    if (this.form.password !== this.form.confirm) {
      errorArr.push('confirm');
      errorArr.push('password');
    }
    //校验邮箱，仅支持qq邮箱，163邮箱，126邮箱，sina邮箱，gmail邮箱，hotmail邮箱，yahoo邮箱，sohu邮箱
    const supported_emails = ['qq.com', '163.com', '126.com', 'sina.com', 'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];
    if (this.form.email.indexOf('@') === -1) {
      errorArr.push('email');
    } else {
      const emailSuffix = this.form.email.split('@')[1];
      if (!supported_emails.includes(emailSuffix)) {
        errorArr.push('email');
      }
    }
    //校验邮箱验证码(6位数字)
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
        this.errorData.push('email'); // 如果邮箱为空，则添加错误提示  
        return;
      }

      // 发送验证码请求到后端（假设service.sendcode是发送验证码的API方法）  
      await service.sendEmailVerificationCode(this.form.email);

      this.isEmailCodeSent = true; // 标记验证码已发送  
      this.countdown = 60; // 设置倒计时60秒  

      // 开始倒计时  
      this.startCountdown();

      this.$plugin.toast('Verification code sent to your email.');

    } catch (e) {
      this.$plugin.toast(JSON.stringify(e));
    }
  }
}
</script>
<style lang="less">
.register-container {
  padding: 20px;
  max-width: 600px;
  margin: auto;
  // 滚动条
  // overflow-y: auto;
  // overflow-y: auto;

  .logo {
    text-align: left;
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 700;
  }

  .title {
    text-align: left;
    margin-bottom: 5vh;
  }

  .register-btn {
    width: 50vw;
    float: right;
    margin: auto;
  }
}
</style>
