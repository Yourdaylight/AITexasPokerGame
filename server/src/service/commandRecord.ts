import { Provide, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/web';
import { ICommandRecord, ICommandRecordService } from '../interface/ICommandRecord';
import { db } from '../lib/sqlite_db'; // 使用正确的引入路径

@Provide('CommandRecordService')
export class CommandRecordService implements ICommandRecordService {
  @Inject()
  ctx: Context;

  async add(commandRecord: ICommandRecord): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO command_record (roomNumber, gameId, userId, type, pot, commonCard, handCard, gameStatus, command, counter)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [commandRecord.roomNumber, commandRecord.gameId, commandRecord.userId, commandRecord.type, commandRecord.pot, commandRecord.commonCard, commandRecord.handCard, commandRecord.gameStatus, commandRecord.command, commandRecord.counter], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ succeed: this.changes === 1 });
        }
      });
    });
  }

  async findPast7DayGameIDsByUserID(userID: number): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT DISTINCT gameId FROM command_record WHERE userId = ? AND create_time >= datetime('now', '-7 days')`;
      db.all(sql, [userID], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const gameIds = rows.map((row: any) => row.gameId);
          resolve(gameIds);
        }
      });
    });
  }

  async findByGameIDs(gameIDs: number[]): Promise<ICommandRecord[]> {
    // SQLite 不直接支持 WHERE IN 与数组绑定，需要动态生成占位符
    const placeholders = gameIDs.map(() => '?').join(',');
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM command_record WHERE gameId IN (${placeholders})`;
      db.all(sql, gameIDs, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(JSON.parse(JSON.stringify(rows)));
        }
      });
    });
  }

  async findByGameID(gameID: number): Promise<ICommandRecord[]> {
    // 注意：此查询涉及到多表 JOIN，确保你的表结构和字段与此查询相匹配
    return new Promise((resolve, reject) => {
      const sql = `SELECT cr.*, u.nickName FROM command_record cr INNER JOIN user u ON u.id = cr.userId WHERE cr.gameId = ?`;
      db.all(sql, [gameID], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(JSON.parse(JSON.stringify(rows)));
        }
      });
    });
  }
}
