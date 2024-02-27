import { Provide, Inject, Plugin } from '@midwayjs/core';
import { Context } from '@midwayjs/web';
import { IRoom, IRoomBasicInfo, IRoomService } from '../interface/IRoom';
import { IGameRoom } from '../interface/IGameRoom';
import { db } from '../lib/sqlite_db'; // 确保这个路径根据您的项目结构是正确的
import { parse } from 'path';

const KeyPrefix = 'room';

@Provide('RoomService')
export default class RoomService implements IRoomService {
  @Inject()
  ctx: Context;

  @Plugin()
  redis: any; // Redis 使用不变

  async findById(uid: string): Promise<IRoom> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM room WHERE id = ?', [uid], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as IRoom); // 假设行数据与 IRoom 接口匹配
        }
      });
    });
  }

  async getRooms(size: number): Promise<IRoomBasicInfo[]> {
    const ret: IRoomBasicInfo[] = [];
    // 获取所有房间号的 Redis 键
    const roomNumbersRet: string[] = await this.redis.keys(`${KeyPrefix}:*`);
    const roomNumbers = roomNumbersRet.map(e => e.split(':')[1]);
  
    if (roomNumbers.length === 0) {
      return ret;
    }
  
    // 构建占位符字符串用于 IN 查询
    const placeholders = roomNumbers.map(() => '?').join(',');
    const sql = `SELECT roomNumber, create_time FROM room WHERE roomNumber IN (${placeholders}) ORDER BY create_time DESC LIMIT ?`;
    
    // 使用 SQLite 查询房间信息
    const roomsInDB: Array<{ roomNumber: string; create_time: string }> = await new Promise((resolve, reject) => {
      db.all(sql, [...roomNumbers, size], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as Array<{ roomNumber: string; create_time: string; }>);
        }
      });
    });
  
    // 获取缓存中的房间信息
    const app = this.ctx.app as any;
    const cachedRooms = app.io.of('/socket').gameRooms;
    if (!cachedRooms) {
      return ret;
    }

    roomsInDB.forEach(r => {
      const room: IGameRoom | undefined = cachedRooms[r.roomNumber];
      if (!room) return;
      const sitPlayers = room.roomInfo.sit;
      const names = sitPlayers.map(sit => sit.player?.nickName).filter(Boolean);
      ret.push({
        roomNumber: r.roomNumber,
        createdAt: Number(new Date(r.create_time)),
        playersNickName: names.join(','),
        playersCount: names.length,
      });
    });
  
    // 排序并返回前 size 条记录
    ret.sort((x, y) => y.playersCount - x.playersCount);
    return ret.slice(0, size);
  }
  

  async findRoomNumber(roomNumber: string): Promise<IRoom> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM room WHERE roomNumber = ?', [roomNumber], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as IRoom);
        }
      });
    });
  }

  async findByRoomNumber(number: string): Promise<boolean> {
    const roomNumber = await this.redis.get(`${KeyPrefix}:${number}`);
    return !!roomNumber;
  }

  async add(isShort: boolean, smallBlind: number, expires: number = 360000): Promise<{ roomNumber: any }> {
    return new Promise((resolve, reject) => {
        const roomNumber = Math.floor(Math.random() * (900000) + 100000).toString();
        const self = this; // 捕获 this 到 self 变量
        db.run('INSERT INTO room (roomNumber, isShort, smallBlind, time) VALUES (?, ?, ?, ?)', 
            [roomNumber , isShort, smallBlind, expires], 
            function(err) {
                if (err) {
                    reject('room add error');
                } else {
                    // 这里的 this 指向 db.run 的上下文，可以使用 this.lastID
                    self.redis.set(`${KeyPrefix}:${roomNumber}`, roomNumber, 'EX', expires)
                    .then(() => resolve({ roomNumber }))
                    .catch(reject);
                }
            }
        );
    });
}

}
