import request from '../utils/request';

export default {
  register: ({ userAccount = '', password = '', nickName = '', code='', email = '' }) =>
    request({
      url: '/user/register',
      body: { userAccount, password, nickName, code, email },
    }),
  login: (userAccount: string, password: string) =>
    request({
      url: '/user/login',
      body: { userAccount, password },
    }),
  checkLogin: () =>
    request({
      url: '/user',
      body: {},
    }),
    
    sendEmailVerificationCode: (email: string) =>
      request({
        url: '/user/sendEmailVerificationCode',
        body: { email },
      }),

      getUsers: () =>{
        return request({
          url: '/user/inactiveUsers',
          body: {},
        });
      },
  createRoom: (isShort: boolean, smallBlind: number, time: number) =>
    request({
      url: '/game/room',
      body: { isShort, smallBlind, time },
    }),
  findRoom: (roomNumber: string) =>
    request({
      url: '/game/room/find',
      body: { roomNumber },
    }),
  getRooms: () =>
    request({
      method: 'GET',
      url: '/game/room',
    }),
  buyIn: (buyInSize: number) =>
    request({
      url: '/game/buyIn',
      body: { buyInSize },
    }),
  commandRecordList: (roomNumber: string, gameId: number) =>
    request({
      url: '/game/record/find/commandRecord',
      body: { roomNumber, gameId },
    }),
  gameRecordList: (roomNumber: string) =>
    request({
      url: '/game/record/find/gameRecord',
      body: { roomNumber },
    }),
  selfPast7DayGame: (userID: number) =>
    request({
      url: '/game/record/find/selfPast7DayGame',
      body: { userID },
    }),

};
