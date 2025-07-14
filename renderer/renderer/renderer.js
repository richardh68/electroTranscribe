"use strict";
// @ts-ignore
const { ipcRenderer } = window.require ? window.require('electron') : {};
let mediaStream = null;
let audioContext = null;
let processor = null;
async function startMicrophone() {
    console.log('[RENDERER] Requesting microphone access...');
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[RENDERER] Microphone access granted');
        audioContext = new window.AudioContext({ sampleRate: 16000 });
        console.log('[RENDERER] AudioContext created');
        const source = audioContext.createMediaStreamSource(mediaStream);
        console.log('[RENDERER] MediaStreamSource created');
        processor = audioContext.createScriptProcessor(1024, 1, 1);
        console.log('[RENDERER] ScriptProcessorNode created');
        source.connect(processor);
        processor.connect(audioContext.destination);
        console.log('[RENDERER] Audio nodes connected');
        processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            // Convert Float32 to 16-bit PCM
            const pcm = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
                let s = Math.max(-1, Math.min(1, input[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            // Log first 10 PCM values
            console.log('[RENDERER] First 10 PCM values:', Array.from(pcm.slice(0, 10)));
            // Send PCM buffer to main process
            ipcRenderer.send('audio-chunk', Buffer.from(pcm.buffer));
        };
    }
    catch (err) {
        console.error('[RENDERER] Error accessing microphone:', err);
    }
}
function stopMicrophone() {
    if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
        processor = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const transcriptionDiv = document.getElementById('transcription');
    const vocabForm = document.getElementById('vocab-form');
    const vocabInput = document.getElementById('vocab-input');
    const vocabList = document.getElementById('vocab-list');
    const modelSelect = document.getElementById('model-select');
    const llmResponseDiv = document.getElementById('llm-response');
    let selectedModelId = null;
    let recording = false;
    function setRecordingState(isRecording) {
        recording = isRecording;
        if (isRecording) {
            recordingIndicator.style.display = 'flex';
            stopBtn.style.display = 'inline-block';
            recordBtn.style.display = 'none';
        }
        else {
            recordingIndicator.style.display = 'none';
            stopBtn.style.display = 'none';
            recordBtn.style.display = 'inline-block';
        }
    }
    recordBtn.onclick = async () => {
        console.log('[RENDERER] Start Recording button clicked');
        await ipcRenderer.invoke('start-audio-recording');
        await startMicrophone();
        console.log('[RENDERER] Sent start-audio-recording IPC and started microphone');
        setRecordingState(true);
        transcriptionDiv.textContent = '';
    };
    stopBtn.onclick = async () => {
        console.log('[RENDERER] Stop button clicked');
        await ipcRenderer.invoke('stop-audio-recording');
        setTimeout(() => {
            stopMicrophone();
            console.log('[RENDERER] Microphone stopped after grace period');
        }, 1000); // 1000ms grace period
        console.log('[RENDERER] Sent stop-audio-recording IPC');
        setRecordingState(false);
    };
    // Fetch models on startup
    ipcRenderer.invoke('get-bedrock-models').then((models) => {
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
        if (models.length > 0) {
            selectedModelId = models[0].id;
            modelSelect.value = selectedModelId;
        }
    });
    modelSelect.onchange = () => {
        selectedModelId = modelSelect.value;
    };
    // Listen for transcription events from main
    let fullTranscript = '';
    ipcRenderer.on('transcription-received', async (_event, transcript) => {
        console.log('[RENDERER] Received transcription:', transcript);
        // Overwrite the container with the latest full transcribed text
        fullTranscript = transcript;
        transcriptionDiv.textContent = fullTranscript;
        transcriptionDiv.scrollTop = transcriptionDiv.scrollHeight;
        llmResponseDiv.textContent = '...';
        if (selectedModelId && fullTranscript.trim()) {
            const response = await ipcRenderer.invoke('invoke-bedrock-llm', { modelId: selectedModelId, prompt: fullTranscript });
            if (response && response.completion) {
                llmResponseDiv.textContent = response.completion;
            }
            else if (response && response.generations && response.generations[0]) {
                llmResponseDiv.textContent = response.generations[0].text;
            }
            else if (response && response.results && response.results[0]) {
                llmResponseDiv.textContent = response.results[0].outputText;
            }
            else if (response && response.error) {
                llmResponseDiv.textContent = '[LLM Error] ' + response.error;
            }
            else {
                llmResponseDiv.textContent = '[No LLM response]';
            }
        }
        else {
            llmResponseDiv.textContent = '';
        }
    });
    // Vocabulary management
    function renderVocabList(vocab) {
        vocabList.innerHTML = '';
        vocab.forEach(v => {
            const div = document.createElement('div');
            div.className = 'vocab-item';
            const span = document.createElement('span');
            span.textContent = v.phrase;
            const btn = document.createElement('button');
            btn.textContent = 'Remove';
            btn.onclick = () => {
                ipcRenderer.invoke('remove-vocabulary', v.phrase);
            };
            div.appendChild(span);
            div.appendChild(btn);
            vocabList.appendChild(div);
        });
    }
    vocabForm.onsubmit = async (e) => {
        e.preventDefault();
        const phrase = vocabInput.value.trim();
        if (phrase) {
            await ipcRenderer.invoke('add-vocabulary', phrase);
            vocabInput.value = '';
        }
    };
    ipcRenderer.on('vocabulary-updated', (_event, vocab) => {
        renderVocabList(vocab);
    });
    // Initial load
    ipcRenderer.invoke('get-vocabularies').then(renderVocabList);
    setRecordingState(false);
});
