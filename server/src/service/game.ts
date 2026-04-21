import { Provide, Inject } from '@midwayjs/decorator';
import { Context } from '@midwayjs/web';
import { IGame, IGameService } from '../interface/IGame';
import { db } from '../lib/sqlite_db'; // 确保这个路径根据您的项目结构是正确的

@Provide('GameService')
export class GameService implements IGameService {
  @Inject()
  ctx: Context;

  async add(game: IGame): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO game (roomNumber, pot, status, commonCard, winners) VALUES (?, ?, ?, ?, ?)`;
      db.run(sql, [game.roomNumber, game.pot, game.status, game.commonCard, game.winners], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ succeed: true, id: this.lastID });
        }
      });
    });
  }

  async update(game: IGame): Promise<any> {
    return new Promise((resolve, reject) => {
      // 注意：SQLite 不支持 ON DUPLICATE KEY UPDATE 语法，这里简化为仅示例更新操作
      const sql = `UPDATE game SET roomNumber = ?, pot = ?, status = ?, commonCard = ?, winners = ? WHERE id = ?`;
      db.run(sql, [game.roomNumber, game.pot, game.status, game.commonCard, game.winners, game.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ succeed: true });
        }
      });
    });
  }

  async findByID(gid: number): Promise<IGame> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM game WHERE id = ?', [gid], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as IGame);
        }
      });
    });
  }

  async findByIDs(ids: number[]): Promise<IGame[]> {
    const placeholders = ids.map(() => '?').join(',');
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM game WHERE id IN (${placeholders})`, ids, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as IGame[]);
        }
      });
    });
  }

  async findByRoomNumber(roomNumber: number): Promise<IGame[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM game WHERE roomNumber = ?', [roomNumber], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as IGame[]);
        }
      });
    });
  }
}
