import { AudioOverlay } from '../core/audioOverlay.js';

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
    jest.restoreAllMocks();
  });

  test('should throw error if no audio file is selected', () => {
    const overlay = new AudioOverlay(videoElement, audioInput, debugElement);
    Object.defineProperty(audioInput, 'files', { value: [], writable: true });
    expect(() => overlay.applyAudio()).toThrow('Select an audio file');
    expect(debugElement.textContent).toBe('Status: Error! Select an audio file');
  });

  test('should apply audio correctly', () => {
    const overlay = new AudioOverlay(videoElement, audioInput, debugElement);
    const mockFile = new File([''], 'audio.mp3', { type: 'audio/mp3' });
    Object.defineProperty(audioInput, 'files', { value: [mockFile], writable: true });
    global.URL.createObjectURL = jest.fn(() => 'mocked-audio-url');
    jest.spyOn(window, 'Audio').mockImplementation(() => ({
      src: '',
      addEventListener: jest.fn(),
    }));
    overlay.applyAudio();
    expect(overlay.audio).not.toBeNull();
    expect(debugElement.textContent).toBe('Status: Audio applied');
  });
});