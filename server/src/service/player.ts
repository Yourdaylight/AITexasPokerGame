import { Provide, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/web';
import { IPlayerDTO, IPlayerService, UpdatePlayerDTO } from '../interface/IPlayer';
import { db } from '../lib/sqlite_db'; // 确保这个路径根据您的项目结构是正确的

@Provide('PlayerRecordService')
export class PlayerService implements IPlayerService {
  @Inject()
  ctx: Context;
  
  async add(gameRecord: IPlayerDTO): Promise<any> {
    return new Promise((resolve, reject) => {
      const { roomNumber, userId, counter, gameId, handCard, buyIn } = gameRecord;
      const sql = 'INSERT INTO player (roomNumber, userId, counter, gameId, handCard, buyIn) VALUES (?, ?, ?, ?, ?, ?)';
      db.run(sql, [roomNumber, userId, counter, gameId, handCard, buyIn], function(err) {
        if (err) {
          reject(err);
        } else {
          // 此处可以返回 lastID 或其他信息，根据需要修改
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async update(updatePlayer: UpdatePlayerDTO): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE player SET counter = ? WHERE id = ?';
      db.run(sql, [updatePlayer.counter, updatePlayer.playerId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async findByRoomNumber(roomNumber: number): Promise<IPlayerDTO[]> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM player WHERE roomNumber = ?';
      db.all(sql, [roomNumber], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // 假设 rows 直接符合 IPlayerDTO[] 的结构
          resolve(rows as IPlayerDTO[]);
        }
      });
    });
  }
}
