import { Provide, Inject } from '@midwayjs/decorator';
import { Context } from '@midwayjs/web';
import { IAccountInfo } from '../interface/IAccountInfo';
import { IUser } from '../interface/IUser';
import { IUserService } from '../interface/service/IUserService';
import { db } from '../lib/sqlite_db'; // 引入SQLite数据库连接

@Provide('UserService')
export class UserService implements IUserService {
  @Inject()
  ctx: Context;

  async findById(uid: string): Promise<IUser> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user WHERE id = ?';
      db.get(sql, [uid], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as IUser);
        }
      });
    });
  }

  async findByAccount(account: string): Promise<IUser> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user WHERE account = ? and is_active=true';
      db.get(sql, [account], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as IUser);
        }
      });
    });
  }

  async addUser(accountInfo: IAccountInfo): Promise<{ succeed: boolean }> {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO user (account, password, nickName, email) VALUES (?, ?, ?, ?)';
      db.run(sql, [accountInfo.userAccount, accountInfo.password, accountInfo.nickName, accountInfo.email], function(err) {
        if (err) {
          reject(err);
        } else {
          // this.lastID refers to the last inserted row ID
          resolve({ succeed: this.lastID ? true : false });
        }
      });
    });
  }

  async activateUser(accountInfo: IAccountInfo): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE user SET is_active = ? WHERE account = ?';
      db.run(sql, [true, accountInfo.userAccount], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ succeed: this.changes ? true : false });
        }
      });
    });
  }
}
