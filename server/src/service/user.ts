import { Provide, Inject } from '@midwayjs/decorator';
import { Context } from '@midwayjs/web';
import { IAccountInfo } from '../interface/IAccountInfo';
import { IUser } from '../interface/IUser';
import { IUserService } from '../interface/service/IUserService';
import { db } from '../lib/sqlite_db';

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
      const sql = 'SELECT * FROM user WHERE account = ? and is_active=1';
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
          resolve({ succeed: this.lastID ? true : false });
        }
      });
    });
  }

  async activateUser(accountInfo: IAccountInfo): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE user SET is_active = ? WHERE account = ?';
      db.run(sql, [1, accountInfo.userAccount], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ succeed: this.changes ? true : false });
        }
      });
    });
  }

  async findAllUsers(page: number = 1, pageSize: number = 20): Promise<{ users: IUser[], total: number }> {
    const offset = (page - 1) * pageSize;
    return new Promise((resolve, reject) => {
      const countSql = 'SELECT COUNT(*) as total FROM user';
      const dataSql = 'SELECT id, nickName, account, email, is_active, is_admin, create_time FROM user ORDER BY id DESC LIMIT ? OFFSET ?';
      db.get(countSql, [], (err, row: any) => {
        if (err) { reject(err); return; }
        const total = row?.total || 0;
        db.all(dataSql, [pageSize, offset], (err2, rows) => {
          if (err2) { reject(err2); return; }
          resolve({ users: rows as IUser[], total });
        });
      });
    });
  }

  async updateUser(id: number, updates: Partial<IUser>): Promise<{ succeed: boolean }> {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.nickName !== undefined) { fields.push('nickName = ?'); values.push(updates.nickName); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }
    if (updates.is_admin !== undefined) { fields.push('is_admin = ?'); values.push(updates.is_admin); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (fields.length === 0) return { succeed: false };
    values.push(id);
    return new Promise((resolve, reject) => {
      const sql = `UPDATE user SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) { reject(err); return; }
        resolve({ succeed: this.changes > 0 });
      });
    });
  }

  async deleteUser(id: number): Promise<{ succeed: boolean }> {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM user WHERE id = ?';
      db.run(sql, [id], function(err) {
        if (err) { reject(err); return; }
        resolve({ succeed: this.changes > 0 });
      });
    });
  }
}
