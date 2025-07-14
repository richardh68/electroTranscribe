import { TranscribeStreamingClient, StartStreamTranscriptionCommand, LanguageCode } from '@aws-sdk/client-transcribe-streaming';
import { awsConfig, transcribeConfig } from '../config/aws';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';

export const transcribeEventEmitter = new EventEmitter();

const client = new TranscribeStreamingClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId!,
    secretAccessKey: awsConfig.secretAccessKey!,
  },
});

export class TranscribeStream {
  private streamSession: any = null;
  private audioStream: PassThrough | null = null;
  private stopRequested = false;

  async start(audioStream: PassThrough) {
    this.audioStream = audioStream;
    this.stopRequested = false;
    console.log('[AWS] Starting Transcribe streaming session...');
    const command = new StartStreamTranscriptionCommand({
      ...transcribeConfig,
      LanguageCode: transcribeConfig.LanguageCode as LanguageCode,
      MediaEncoding: transcribeConfig.MediaEncoding as any, // as MediaEncoding,
      AudioStream: this.getAudioStream(),
    });
    try {
      const response = await client.send(command);
      for await (const event of response.TranscriptResultStream!) {
        console.log('[AWS] Received event from AWS:', event);
        if (event.TranscriptEvent && event.TranscriptEvent.Transcript?.Results) {
          for (const result of event.TranscriptEvent.Transcript.Results) {
            if (result.Alternatives && result.Alternatives.length > 0) {
              const transcript = result.Alternatives[0].Transcript;
              if (transcript && transcript.length > 0) {
                console.log('[AWS] Emitting transcript:', transcript);
                transcribeEventEmitter.emit('transcription', { Transcript: transcript });
              }
            }
          }
        }
        if (this.stopRequested) break;
      }
      // AWS stream is fully closed
      transcribeEventEmitter.emit('transcribe-ended');
    } catch (err) {
      console.error('[AWS] Transcribe error:', err);
      transcribeEventEmitter.emit('transcription', { Transcript: '[Transcribe error] ' + err });
      transcribeEventEmitter.emit('transcribe-ended');
    }
  }

  stop() {
    this.stopRequested = true;
    if (this.audioStream) {
      this.audioStream.end();
      this.audioStream = null;
    }
  }

  private async *getAudioStream() {
    if (!this.audioStream) return;
    for await (const chunk of this.audioStream) {
      yield { AudioEvent: { AudioChunk: chunk } };
      if (this.stopRequested) break;
    }
  }
}

export function onTranscription(callback: (data: any) => void) {
  transcribeEventEmitter.on('transcription', callback);
} 