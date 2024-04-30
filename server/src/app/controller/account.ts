import { Controller, Inject, Post, Get, Provide } from '@midwayjs/core';
import { IAccountInfo } from '../../interface/IAccountInfo';
import { IAccountService } from '../../interface/service/IAccountService';
import BaseController from '../../lib/baseController';

@Provide()
@Controller('/node/user/')
export class Account extends BaseController {
  @Inject('AccountService')
  service: IAccountService;

  @Post('/login')
  async login() {
    try {
      const { body } = this.getRequestBody();
      console.log(body, 'body');
      const { userAccount, password } = body;
      console.log(userAccount, 'userAccount');
      const accountInfo: IAccountInfo = { userAccount, password };
      const result = await this.service.login(accountInfo);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('login-----:', e);
      this.fail(e);
    }
  }

  @Post('/register')
  async register() {
    try {
      const { body } = this.getRequestBody();
      console.log(body);
      const { userAccount, password, nickName, email, code} = body;
      const accountInfo: IAccountInfo = { userAccount, password, nickName, email, code };
      const result = await this.service.register(accountInfo);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('login-----:', e);
      this.fail(e);
    }
  }

  @Post('/sendEmailVerificationCode')
  async sendEmailVerificationCode() {
    try {
      const { body } = this.getRequestBody();
      console.log(body);
      const { email } = body;
      const result = await this.service.sendEmailVerificationCode(email);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('login-----:', e);
      this.fail(e);
    }
  }

  @Get('/verify')
  async verify() {
    try {
      const { verify_id, emailCode } = this.ctx.query;
      const result = await this.service.verify(verify_id, emailCode);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('login-----:', e);
      this.fail(e);
    }
  }
}
