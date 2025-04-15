import { AudioOverlay } from '../audioOverlay.js';

describe('AudioOverlay', () => {
  let videoElement, audioInput, debugElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
    audioInput = document.createElement('input');
    audioInput.type = 'file';
    debugElement = document.createElement('p');
    document.body.appendChild(videoElement);
    document.body.appendChild(audioInput);
    document.body.appendChild(debugElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if no audio file is selected', () => {
    const overlay = new AudioOverlay(videoElement, audioInput, debugElement);
    audioInput.files = new DataTransfer().files;
    expect(() => overlay.applyAudio()).toThrow('Select an audio file');
    expect(debugElement.textContent).toBe('Status: Error! Select an audio file');
  });

  test('should apply audio correctly', () => {
    const overlay = new AudioOverlay(videoElement, audioInput, debugElement);
    const mockFile = new File([''], 'audio.mp3', { type: 'audio/mp3' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(mockFile);
    audioInput.files = dataTransfer.files;

    overlay.applyAudio();
    expect(overlay.audio).not.toBeNull();
    expect(debugElement.textContent).toBe('Status: Audio applied');
  });
});