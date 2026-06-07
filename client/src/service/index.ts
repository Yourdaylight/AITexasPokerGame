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
  createRoom: (isShort: boolean, smallBlind: number, time: number, botConfig?: any) =>
    request({
      url: '/game/room',
      body: { isShort, smallBlind, time, ...botConfig },
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
  // AI Advisor with PokerSkill - SSE streaming
  getAIAdvisor: (data: any, onMessage: (chunk: string) => void, onError: (err: string) => void, onClose: () => void) => {
    const token = cookie.get('token') || localStorage.getItem('token');
    const url = `${origin.urls[0]}/node/ai/advisor`;
    console.log('[AI-Advisor][service] fetch start', url);
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }).then(async response => {
      console.log('[AI-Advisor][service] response status', response.status, 'ok', response.ok);
      console.log('[AI-Advisor][service] content-type', response.headers.get('content-type'));
      if (!response.ok) {
        let errText = '';
        try {
          errText = await response.text();
        } catch (e) { /* ignore */ }
        console.error('[AI-Advisor][service] response not ok', response.status, errText);
        onError(`HTTP ${response.status}: ${errText || response.statusText}`);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) { onError('No response body'); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        console.log('[AI-Advisor][service] stream closed');
        onClose();
      };
      function read() {
        reader!.read().then(({ done, value }) => {
          if (done) { safeClose(); return; }
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          // SSE events are separated by double newlines
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const block of parts) {
            for (const line of block.split('\n')) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr === '[DONE]') { safeClose(); return; }
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.error) { onError(parsed.error); return; }
                if (parsed.delta) onMessage(parsed.delta);
              } catch (e) { /* skip non-JSON */ }
            }
          }
          read();
        }).catch(err => {
          console.error('[AI-Advisor][service] read error', err);
          onError(err.message || 'Stream error');
        });
      }
      read();
    }).catch(err => {
      console.error('[AI-Advisor][service] fetch error', err);
      onError(err.message || 'Request failed');
    });
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

  // AI Conversation History
  getAIConversations: () =>
    request({
      method: 'GET',
      url: '/ai/conversation',
      body: {},
    }),
  getAIConversationDetail: (id: number) =>
    request({
      method: 'GET',
      url: `/ai/conversation/${id}`,
      body: {},
    }),
  saveAIConversation: (data: any) =>
    request({
      url: '/ai/conversation',
      body: data,
    }),
  deleteAIConversation: (id: number) =>
    request({
      method: 'DELETE',
      url: `/ai/conversation/${id}`,
      body: {},
    }),
};
