import { AudioOverlay } from '../core/audioOverlay.js';

describe('AudioOverlay', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
      audioInput: document.createElement('input'),
    };
    dependencies.audioInput.type = 'file';
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.audioInput);

    global.URL.createObjectURL = jest.fn(() => 'mocked-audio-url');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('should throw error if no audio file is selected', () => {
    const overlay = new AudioOverlay(dependencies);
    Object.defineProperty(dependencies.audioInput, 'files', { value: [], writable: true });
    expect(() => overlay.process({})).toThrow('Select an audio file');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! Select an audio file');
  });

  test('should apply audio correctly', () => {
    const overlay = new AudioOverlay(dependencies);
    const mockFile = new File([''], 'audio.mp3', { type: 'audio/mp3' });
    Object.defineProperty(dependencies.audioInput, 'files', { value: [mockFile], writable: true });
    jest.spyOn(window, 'Audio').mockImplementation(() => ({
      src: '',
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      addEventListener: jest.fn(),
    }));

    overlay.process({});
    expect(overlay.audio).not.toBeNull();
    expect(overlay.audio.loop).toBe(true);
    expect(dependencies.debugElement.textContent).toBe('Status: Audio applied');
  });
});