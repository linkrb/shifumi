import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { safeSend, broadcastToGame } = require('../../utils/wsUtils');
const { createMockWs, createMockWsPair } = require('../helpers/mockWs');

describe('wsUtils', () => {
    describe('safeSend', () => {
        it('should send JSON when connection is open', () => {
            const ws = createMockWs();
            safeSend(ws, { type: 'test', value: 42 });

            const messages = ws.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ type: 'test', value: 42 });
        });

        it('should not crash when connection is closed', () => {
            const ws = createMockWs();
            ws.close();
            expect(() => safeSend(ws, { type: 'test' })).not.toThrow();
            expect(ws.getMessages()).toHaveLength(0);
        });

        it('should not send when readyState is not OPEN', () => {
            const ws = createMockWs();
            ws.readyState = 0; // CONNECTING
            safeSend(ws, { type: 'test' });
            expect(ws.getMessages()).toHaveLength(0);
        });
    });

    describe('broadcastToGame', () => {
        it('should send to all players', () => {
            const [ws1, ws2] = createMockWsPair();
            const game = { players: [ws1, ws2] };

            broadcastToGame(game, { type: 'update', data: 'hello' });

            expect(ws1.getMessages()).toHaveLength(1);
            expect(ws1.getLastMessage()).toEqual({ type: 'update', data: 'hello' });
            expect(ws2.getMessages()).toHaveLength(1);
            expect(ws2.getLastMessage()).toEqual({ type: 'update', data: 'hello' });
        });

        it('should skip closed connections', () => {
            const [ws1, ws2] = createMockWsPair();
            ws2.close();
            const game = { players: [ws1, ws2] };

            broadcastToGame(game, { type: 'update' });

            expect(ws1.getMessages()).toHaveLength(1);
            expect(ws2.getMessages()).toHaveLength(0);
        });
    });
});
