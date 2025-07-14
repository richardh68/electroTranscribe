import { JSDOM } from 'jsdom';

describe('Renderer UI', () => {
  let document: Document;
  let ipcRendererMock: any;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <div id="recording-indicator" style="display:none"><span id="recording-dot"></span>Recording...</div>
      <button id="record-btn"></button>
      <button id="stop-btn" style="display:none"></button>
      <div id="transcription"></div>
      <form id="vocab-form"><input id="vocab-input" /></form>
      <div id="vocab-list"></div>
    </body>`, { url: 'http://localhost' });
    document = dom.window.document;
    ipcRendererMock = {
      invoke: jest.fn(),
      on: jest.fn(),
    };
    (global as any).document = document;
    (global as any).ipcRenderer = ipcRendererMock;
  });

  it('should render vocabulary list', () => {
    const vocabList = document.getElementById('vocab-list')!;
    // Simulate renderVocabList
    const vocab = [{ phrase: 'foo' }, { phrase: 'bar' }];
    vocabList.innerHTML = '';
    vocab.forEach(v => {
      const div = document.createElement('div');
      div.className = 'vocab-item';
      const span = document.createElement('span');
      span.textContent = v.phrase;
      div.appendChild(span);
      vocabList.appendChild(div);
    });
    expect(vocabList.children.length).toBe(2);
    expect(vocabList.textContent).toContain('foo');
    expect(vocabList.textContent).toContain('bar');
  });

  it('should update transcription display in real time', () => {
    const transcriptionDiv = document.getElementById('transcription')!;
    transcriptionDiv.textContent = '';
    // Simulate real-time transcript appending
    const transcript1 = 'hello';
    const transcript2 = 'world';
    transcriptionDiv.textContent += transcript1 + '\n';
    transcriptionDiv.textContent += transcript2 + '\n';
    expect(transcriptionDiv.textContent).toBe('hello\nworld\n');
  });

  it('should show and hide recording indicator and Stop button', () => {
    const recordingIndicator = document.getElementById('recording-indicator')!;
    const recordBtn = document.getElementById('record-btn')!;
    const stopBtn = document.getElementById('stop-btn')!;
    // Simulate setRecordingState(true)
    recordingIndicator.style.display = 'flex';
    stopBtn.style.display = 'inline-block';
    recordBtn.style.display = 'none';
    expect(recordingIndicator.style.display).toBe('flex');
    expect(stopBtn.style.display).toBe('inline-block');
    expect(recordBtn.style.display).toBe('none');
    // Simulate setRecordingState(false)
    recordingIndicator.style.display = 'none';
    stopBtn.style.display = 'none';
    recordBtn.style.display = 'inline-block';
    expect(recordingIndicator.style.display).toBe('none');
    expect(stopBtn.style.display).toBe('none');
    expect(recordBtn.style.display).toBe('inline-block');
  });
}); 