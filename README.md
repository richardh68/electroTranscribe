# Electron Speech-to-Text App (with AWS Transcribe)

## Overview
This Electron app provides real-time speech-to-text transcription using AWS Transcribe. It features audio recording, streaming to AWS, and custom vocabulary management, all built with an event-driven architecture.

## Project Structure
- `main/` — Electron main process (audio recording, IPC)
- `renderer/` — Renderer process (UI, not yet implemented)
- `src/awsTranscribe.ts` — Streams audio to AWS Transcribe, emits transcription events
- `config/aws.ts` — Loads AWS credentials/config from `.env` (never commit secrets)
- `test/` — Unit tests (Jest)

## Features Implemented
### 1. Basic File Structure
- Electron app scaffolded with TypeScript, Jest, and AWS SDK
- Folders for main, renderer, config, src, and test

### 2. Audio Recording (Main Process)
- Event-driven audio recording logic in `main/main.ts`
- Emits audio chunk events for further processing
- Fully unit tested

### 3. AWS Transcribe Streaming
- `src/awsTranscribe.ts` streams audio chunks to AWS Transcribe (simulated for tests)
- Emits transcription events
- Uses `.env` for AWS credentials/config (see `.env.example`)
- Fully unit tested

## Running the App

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Set up your environment variables:**
   - Copy `.env.example` to `.env` and fill in your AWS credentials and config.
   - Example:
     ```bash
     cp .env.example .env
     # Edit .env with your AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.
     ```
3. **Build (if needed):**
   ```bash
   npx tsc
   ```
4. **Start the Electron app:**
   ```bash
   npx electron .
   ```
   Or, if you want to use a script, add this to your `package.json`:
   ```json
   "scripts": {
     "start": "electron ."
   }
   ```
   Then run:
   ```bash
   npm start
   ```

## Running Tests
See above for test instructions.

## Next Steps
- Step 4: Custom vocabulary management (load/update from JSON)
- Step 5: Renderer process and UI
- Step 6: Event-driven integration
- Step 7: Full module connection

## Security
- **Never commit real secrets.** Use `.env` and `.env.example` for configuration.

---
For more details, see the code and tests in each module. 