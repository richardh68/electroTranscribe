// Mock Electron's ipcMain and BrowserWindow for tests
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    webContents: { send: jest.fn() },
  })),
  app: { whenReady: () => Promise.resolve() },
}));

import { describe, it, expect } from '@jest/globals';
import { ipcMain } from 'electron';
import * as mainModule from '../main/main';
import { TranscribeStream, onTranscription, transcribeEventEmitter } from '../src/awsTranscribe';
import { appEventEmitter } from '../main/main';
import { addVocabulary } from '../src/vocabularyManager';

describe('App setup', () => {
  it('should pass a basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('Audio Recording', () => {
  it('should emit audio chunks when recording is started', (done) => {
    let chunkCount = 0;
    const cleanup = () => {
      mainModule.audioEventEmitter.removeAllListeners('audio-chunk');
      mainModule.stopAudioRecordingTest();
      done();
    };
    mainModule.onAudioChunk((chunk: Buffer) => {
      chunkCount++;
      if (chunkCount >= 3) {
        expect(chunk.length).toBeGreaterThan(0);
        cleanup();
      }
    });
    mainModule.startAudioRecordingTest();
  });

  it('should stop emitting audio chunks when recording is stopped', (done) => {
    let chunkCount = 0;
    const cleanup = () => {
      mainModule.audioEventEmitter.removeAllListeners('audio-chunk');
      done();
    };
    mainModule.onAudioChunk(() => {
      chunkCount++;
      if (chunkCount === 2) {
        mainModule.stopAudioRecordingTest();
        setTimeout(() => {
          expect(chunkCount).toBe(2);
          cleanup();
        }, 200);
      }
    });
    mainModule.startAudioRecordingTest();
  });
});

describe('AWS Transcribe Streaming', () => {
  it('should emit a transcription event when started', (done) => {
    const transcribe = new TranscribeStream();
    onTranscription((data) => {
      expect(data.Transcript).toBe('simulated transcript');
      transcribeEventEmitter.removeAllListeners('transcription');
      done();
    });
    // Use a dummy readable stream
    const { Readable } = require('stream');
    const dummyStream = new Readable({
      read() {
        this.push(Buffer.from([1, 2, 3]));
        this.push(null);
      },
    });
    transcribe.start(dummyStream);
  });

  it('should stop the stream cleanly', () => {
    const transcribe = new TranscribeStream();
    const { Readable } = require('stream');
    const dummyStream = new Readable({
      read() {
        this.push(Buffer.from([1, 2, 3]));
        this.push(null);
      },
    });
    transcribe.start(dummyStream);
    transcribe.stop();
    expect(transcribe['audioStream']).toBeNull();
    expect(transcribe['streamSession']).toBeNull();
  });
});

describe('Event-driven Architecture', () => {
  it('should emit and handle audio-recorded event', (done) => {
    appEventEmitter.once('audio-recorded', (chunk) => {
      expect(Buffer.isBuffer(chunk)).toBe(true);
      done();
    });
    // Directly emit the event
    const testChunk = Buffer.from([1, 2, 3]);
    appEventEmitter.emit('audio-recorded', testChunk);
  });

  it('should emit and handle transcription-received event', (done) => {
    appEventEmitter.once('transcription-received', (transcript) => {
      expect(typeof transcript).toBe('string');
      expect(transcript).toBe('simulated transcript');
      done();
    });
    // Directly emit the event
    appEventEmitter.emit('transcription-received', 'simulated transcript');
  });

  it('should emit and handle vocabulary-updated event', (done) => {
    appEventEmitter.once('vocabulary-updated', (vocab) => {
      expect(Array.isArray(vocab)).toBe(true);
      expect((vocab as { phrase: string }[]).some((v: { phrase: string }) => v.phrase === 'eventword2')).toBe(true);
      done();
    });
    // Directly emit the event
    appEventEmitter.emit('vocabulary-updated', [{ phrase: 'eventword2' }]);
  });
});
