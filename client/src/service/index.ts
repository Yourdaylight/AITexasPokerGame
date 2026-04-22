import request from '../utils/request';
import origin from '../utils/origin';
import cookie from 'js-cookie';

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

  // Admin APIs
  getAdminUsers: (page: number = 1, pageSize: number = 20) =>
    request({
      method: 'GET',
      url: `/admin/users?page=${page}&pageSize=${pageSize}`,
      body: {},
    }),
  updateAdminUser: (id: number, updates: any) =>
    request({
      method: 'PUT',
      url: `/admin/users/${id}`,
      body: updates,
    }),
  deleteAdminUser: (id: number) =>
    request({
      method: 'DELETE',
      url: `/admin/users/${id}`,
      body: {},
    }),
  // AI Advisor - SSE streaming
  getAIAnalysis: (data: any, onMessage: (chunk: string) => void, onError: (err: string) => void, onClose: () => void) => {
    const token = cookie.get('token') || localStorage.getItem('token');
    const url = `${origin.urls[0]}/node/ai/analyze`;
    // Use fetch with ReadableStream instead of EventSource (needs POST)
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }).then(response => {
      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      function read() {
        reader!.read().then(({ done, value }) => {
          if (done) {
            onClose();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const block of lines) {
            const dataLine = block.split('\n').find(l => l.startsWith('data:'));
            if (dataLine) {
              const jsonStr = dataLine.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.delta) {
                  onMessage(parsed.delta);
                } else if (parsed.error) {
                  onError(parsed.error);
                }
              } catch (e) {
                // ignore malformed
              }
            }
          }
          read();
        }).catch(err => {
          onError(err.message || 'read error');
        });
      }
      read();
    }).catch(err => {
      onError(err.message || 'fetch error');
    });
    return { abort: () => {} };
  },
  compressAIContext: (data: any) =>
    request({
      url: '/ai/compress',
      body: data,
      timeout: 20000,
    }),
  testAIConfig: (data: any) =>
    request({
      url: '/ai/analyze',
      body: data,
      timeout: 20000,
    }),

  // AI Config (database-backed, per-user)
  getAIConfigs: () =>
    request({
      method: 'GET',
      url: '/ai/config',
      body: {},
    }),
  createAIConfig: (data: any) =>
    request({
      url: '/ai/config',
      body: data,
    }),
  updateAIConfig: (id: number, data: any) =>
    request({
      method: 'PUT',
      url: `/ai/config/${id}`,
      body: data,
    }),
  deleteAIConfig: (id: number) =>
    request({
      method: 'DELETE',
      url: `/ai/config/${id}`,
      body: {},
    }),
};
