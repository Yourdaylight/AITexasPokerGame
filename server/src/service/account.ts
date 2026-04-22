import { Config, Inject, Plugin, Provide } from '@midwayjs/core';
import { Context } from '@midwayjs/web';
import { IAccountInfo } from '../interface/IAccountInfo';
import { ILoginResult } from '../interface/ILoginResult';
import { IUser } from '../interface/IUser';
import { IAccountService } from '../interface/service/IAccountService';
import { IUserService } from '../interface/service/IUserService';
import BaseService from '../lib/baseService';
import { PROTOCOL } from 'sqlite3';
import { existsSync, writeFileSync, readFileSync } from 'fs';

@Provide('AccountService')
export class AccountService extends BaseService implements IAccountService {
  @Inject()
  ctx: Context;

  @Plugin()
  jwt: any;

  @Inject('UserService')
  user: IUserService;

  @Config('jwt')
  protected jwtConfig: any;

  sessionFilePath = 'session.json';
  texasUrl = 'https://programtree.cn/texasPoker';
// 抽象邮件发送逻辑
  private async sendEmail(data: any): Promise<any> {
    return this.ctx.curl('http://192.168.1.6:18081/send_email', {
      method: 'POST',
      data,
      headers: {
        'Content-Type': 'application/json',
      },
      dataType: 'json',
    });
  }

  public login(accountInfo: IAccountInfo): Promise<ILoginResult> {
    return new Promise(async (resolve, reject) => {
      try {
        let token = '';
        // 校验用户信息
        const isAuth = await this.authUser(accountInfo);
        if (isAuth) {
          token = await this.getToken(accountInfo.userAccount);
        }
        const result: ILoginResult = { token };
        resolve(result);
      } catch (e) {
        this.ctx.logger.error('login service error:', e);
        reject(e);
      }
    });
  }

  public async register(accountInfo: IAccountInfo): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const hasUser = await this.checkHasUser(accountInfo.userAccount);
        //与session中的code比对一致性
        if (accountInfo.code !== this.ctx.session.emailCode) {
          reject('Verification code error');
        }
        console.log('accountInfo', hasUser, accountInfo);
        if (!hasUser) {
          const result = await this.user.addUser(accountInfo);
          if (result.succeed) {
            //添加完成后生成一个url给管理员审核，审核通过后才能登录。域名为当前的base_url+session_id
            const url = `${this.ctx.request.origin}/node/user/verify?verify_id=${this.ctx.session.verify_id}&emailCode=${accountInfo.code}`;
            //当前seesion_id的所有信息也获取后放到邮件中
            const session = this.ctx.session;
            const sessionInfo = {
              userAccount: accountInfo.userAccount,
              nickName: accountInfo.nickName,
              email: accountInfo.email,
              verify_id: this.ctx.session.verify_id,
              generateTime: new Date().getTime(), // 记录生成时间
              expireTime: 5 * 60 * 1000, // 设置超时时间，单位为毫秒
            };

            // 读取当前的session信息,定义sessions为any
            let sessions: any = {};
            if (existsSync(this.sessionFilePath)) {
              sessions = JSON.parse(readFileSync(this.sessionFilePath, 'utf8'));
            }

            // 添加新的verify_id对应的信息
            sessions[sessionInfo.verify_id] = sessionInfo;

            // 写入文件
            writeFileSync(this.sessionFilePath, JSON.stringify(sessions, null, 2));
            const email_data = {
              to: '526494747@qq.com',
              subject: '🎴New user register',
              content: `User ${accountInfo.userAccount} has registered, please verify it by clicking the link below: ${url} \n\n session: ${JSON.stringify(session)}`,
            }
            const res = await this.sendEmail(email_data);


            resolve('注册成功！请等待管理员审核通过后可以登陆');
          }
        } else {
          reject('User already exists');
        }
      } catch (e) {
        this.ctx.logger.error('register service error:', e);
        reject(e);
      }
    });
  }

  public async verify(verify_id: string, emailCode: string) {
    //解密verify_id，获取code和email
    //校验code和email是否和session中的一致
    this.ctx.logger.info(`verify_id--${verify_id}, emailCode--${emailCode}`);
    //遍历所有的session查看是否有匹配的
    const sessions = JSON.parse(readFileSync(this.sessionFilePath, 'utf8'));
    this.ctx.logger.info(`sessions--${sessions}`);
    // 查找对应的verify_id
    const sessionInfo = sessions[verify_id];
    if (sessionInfo) {
        //校验通过后，将用户信息写入数据库
        const activated = await this.user.activateUser({
          userAccount: sessionInfo.userAccount,
          password: this.ctx.session.password,
          nickName: sessionInfo.nickName,
          email: sessionInfo.email,
        });
        if (!activated) {
          throw 'activate failed';
        }
        //将session中的信息清空
        this.ctx.session.password = '';
        //成功后给用户发送邮件
        const email_data =  {
          to: sessionInfo.email,
          subject: '🎴激活成功',
          content: `激活成功，您的账号为${sessionInfo.userAccount}，请点击链接登录：${this.texasUrl}`,
        }
        const res = await this.sendEmail(email_data);
        //返回注册成功
        return 'verify successful';
    }
    throw 'no session found';

  }

  public async authUser(accountInfo: IAccountInfo) {
    const user: IUser = await this.checkHasUser(accountInfo.userAccount);
    const valid = user.password === accountInfo.password;
    if (!valid) {
      throw 'incorrect user account or password.';
    }
    return valid;
  }

  public async sendEmailVerificationCode(email: string) {
    //将验证码写入当前用户的session中
    const code = Math.random().toString().slice(-6);
    this.ctx.session.emailCode = code;
    this.ctx.session.email = email;
    // 基于code和email生成一个verify_id加密后存入session
    const verify_id = this.jwt.sign(
      {
        code,
        email,
      },
      this.jwtConfig.secret,
      { expiresIn: 60 * 5 },
    );
    this.ctx.session.verify_id = verify_id;
    //设置session.verify_id的过期时间为5分钟
    setTimeout(() => {
      this.ctx.session.verify_id = '';
    }, 1000 * 60 * 5);
    const email_data = {
      to: email,
      subject: '🎴Verification Code',
      content: `Your verification code is 【${code}】, please enter it in the registration page.`,
    }
    const res = await this.sendEmail(email_data);
    this.ctx.logger.info(`sendEmailVerificationCode res--${res}`);
    return 'send email verification code successful'
  }

  private async checkHasUser(userAccount: string): Promise<IUser> {
    return await this.user.findByAccount(userAccount);
  }

  private async getToken(userAccount: string) {
    const { nickName, account, id, is_admin } = await this.user.findByAccount(userAccount);
    const token = this.jwt.sign(
      {
        user: {
          nickName,
          account,
          userId: id,
          isAdmin: is_admin || 0,
        },
      },
      this.jwtConfig.secret,
      { expiresIn: 60 * 60 * 24 * 360 },
    );
    this.ctx.logger.info(`AccountService getToken token--${token}`);
    return token;
  }
}
