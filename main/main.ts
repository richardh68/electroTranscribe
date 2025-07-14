import { app, BrowserWindow, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { TranscribeStream, onTranscription, transcribeEventEmitter } from '../src/awsTranscribe';
import { getVocabularies, addVocabulary, removeVocabulary, onVocabularyUpdated } from '../src/vocabularyManager';
import { PassThrough } from 'stream';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { awsConfig } from '../config/aws';

// Event emitter for audio events
export const audioEventEmitter = new EventEmitter();
// Event emitter for app-wide events
export const appEventEmitter = new EventEmitter();

let mainWindow: BrowserWindow | null = null;
// Remove ListFoundationModelsCommand and model listing if not supported by Bedrock Runtime
const staticModels = [
  { id: 'anthropic.claude-v2', name: 'Anthropic Claude v2' },
  { id: 'anthropic.claude-instant-v1', name: 'Anthropic Claude Instant v1' },
  { id: 'ai21.j2-ultra-v1', name: 'AI21 J2 Ultra v1' },
  { id: 'ai21.j2-mid-v1', name: 'AI21 J2 Mid v1' },
  { id: 'amazon.titan-tg1-large', name: 'Amazon Titan TG1 Large' }
];
let availableModels: any[] = staticModels;

async function fetchBedrockModels() {
  try {
    const client = new BedrockClient({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId!,
        secretAccessKey: awsConfig.secretAccessKey!,
      },
    });
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    if (response.modelSummaries && Array.isArray(response.modelSummaries)) {
      availableModels = response.modelSummaries.map((m: any) => ({
        id: m.modelId,
        name: m.modelName || m.modelId,
        provider: m.providerName,
        inputModalities: m.inputModalities,
        outputModalities: m.outputModalities,
        streaming: m.responseStreamingSupported,
      }));
      console.log('[BEDROCK] Fetched models:', availableModels);
    } else {
      availableModels = staticModels;
      console.warn('[BEDROCK] No modelSummaries in response, using static models.');
    }
  } catch (err) {
    availableModels = staticModels;
    console.error('[BEDROCK] Error fetching models, using static models:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile('renderer/index.html');
}

// Remove fetchBedrockModels and related code, as Bedrock Runtime does not support model listing

if (process.env.NODE_ENV !== 'test') {
  app.whenReady().then(async () => {
    await fetchBedrockModels();
    createWindow();
    // Bedrock Runtime does not support model listing, so we use staticModels
  });

  // IPC handlers for vocabulary management
  ipcMain.handle('get-vocabularies', () => {
    return getVocabularies();
  });
  ipcMain.handle('add-vocabulary', (_event, phrase: string) => {
    addVocabulary({ phrase });
    return getVocabularies();
  });
  ipcMain.handle('remove-vocabulary', (_event, phrase: string) => {
    removeVocabulary(phrase);
    return getVocabularies();
  });

  // Relay vocabulary-updated events to renderer and app event emitter
  onVocabularyUpdated((vocab) => {
    if (mainWindow) {
      mainWindow.webContents.send('vocabulary-updated', vocab);
    }
    appEventEmitter.emit('vocabulary-updated', vocab);
  });

  // Transcription streaming integration
  // (Removed duplicate let transcribeStream and let audioInputStream here)

  ipcMain.handle('start-audio-recording', async () => {
    console.log('[MAIN] Received start-audio-recording');
    recording = true;
    audioInputStream = new PassThrough();
    console.log('[MAIN] audioInputStream set:', !!audioInputStream);
    console.log('[MAIN] Starting AWS Transcribe stream...');
    // Start AWS Transcribe streaming (real audio)
    transcribeStream = new TranscribeStream();
    transcribeStream.start(audioInputStream);
    // Listen for transcription events
    onTranscription((data) => {
      console.log('[MAIN] Transcription event:', data.Transcript);
      if (mainWindow) {
        mainWindow.webContents.send('transcription-received', data.Transcript);
      }
      appEventEmitter.emit('transcription-received', data.Transcript);
    });
    console.log('[MAIN] start-audio-recording handler complete');
    return true;
  });

  ipcMain.handle('stop-audio-recording', async () => {
    console.log('[MAIN] Received stop-audio-recording');
    recording = false;
    if (audioInputStream) {
      audioInputStream.end();
      audioInputStream = null;
      console.log('[MAIN] audioInputStream cleared');
    }
    if (transcribeStream) {
      transcribeStream.stop();
      // Wait for AWS to finish sending results before cleanup
      const cleanup = () => {
        transcribeStream = null;
        transcribeEventEmitter.off('transcribe-ended', cleanup);
        console.log('[MAIN] transcribeStream cleaned up after AWS ended');
      };
      transcribeEventEmitter.on('transcribe-ended', cleanup);
    }
    return true;
  });

  ipcMain.handle('get-bedrock-models', async () => {
    return availableModels;
  });

  ipcMain.handle('invoke-bedrock-llm', async (_event, { modelId, prompt }) => {
    try {
      const client = new BedrockRuntimeClient({ region: awsConfig.region, credentials: { accessKeyId: awsConfig.accessKeyId!, secretAccessKey: awsConfig.secretAccessKey! } });
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ prompt }),
      });
      const response = await client.send(command);
      const body = JSON.parse(new TextDecoder().decode(response.body));
      return body;
    } catch (err) {
      console.error('[BEDROCK] Error invoking LLM:', err);
      return { error: String(err) };
    }
  });
}

// --- Event-driven integration ---
// Listen for audio-recorded and stream to AWS Transcribe
appEventEmitter.on('audio-recorded', (chunk: Buffer) => {
  if (transcribeStream && transcribeStream['audioStream']) {
    console.log('[MAIN] Pushing chunk to transcribeStream');
    // In a real app, push chunk to the audio stream for AWS
    (transcribeStream['audioStream'] as NodeJS.ReadableStream & { push: (chunk: Buffer) => void }).push(chunk);
  }
});

// Listen for vocabulary-updated and (optionally) update AWS Transcribe config
appEventEmitter.on('vocabulary-updated', (vocab) => {
  // In a real app, update AWS Transcribe custom vocabulary here
  // For now, just log or handle as needed
  // console.log('Vocabulary updated:', vocab);
});

// Audio recording logic (stub for event-driven architecture)
let recording = false;
let audioStream: Readable | null = null;
let transcribeStream: TranscribeStream | null = null;
let audioInputStream: PassThrough | null = null;

function emitAudioRecorded(chunk: Buffer) {
  audioEventEmitter.emit('audio-chunk', chunk);
  appEventEmitter.emit('audio-recorded', chunk);
}

export function onAudioChunk(callback: (chunk: Buffer) => void) {
  audioEventEmitter.on('audio-chunk', callback);
}

// For tests: direct control functions
export function startAudioRecordingTest() {
  recording = true;
  audioStream = new Readable({
    read() {
      if (recording) {
        const chunk = Buffer.from([Math.random() * 255]);
        this.push(chunk);
        audioEventEmitter.emit('audio-chunk', chunk);
      } else {
        this.push(null);
      }
    },
  });
  const interval = setInterval(() => {
    if (recording && audioStream) {
      audioStream.read();
    } else {
      clearInterval(interval);
    }
  }, 100);
}

export function stopAudioRecordingTest() {
  recording = false;
  if (audioStream) {
    audioStream.push(null);
    audioStream = null;
  }
}

ipcMain.on('audio-chunk', (_event, chunk: Buffer) => {
  if (audioInputStream) {
    console.log('[MAIN] Received audio chunk of size', chunk.length, 'First 10 bytes:', Array.from(chunk.slice(0, 10)));
    (audioInputStream as PassThrough).write(chunk);
  } else {
    console.log('[MAIN] Received audio chunk but audioInputStream is null');
  }
});
