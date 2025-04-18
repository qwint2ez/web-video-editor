import { VideoEditor } from '../core/videoEditor.js';

describe('VideoEditor', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
      audioInput: document.createElement('input'),
      inputElement: document.createElement('input'),
      textElement: document.createElement('div'),
      timelineRange: document.createElement('input'),
      currentTime: document.createElement('span'),
      duration: document.createElement('span'),
      playPauseBtn: document.createElement('button'),
      endInput: document.createElement('input'),
      startInput: document.createElement('input'),
    };
    dependencies.audioInput.type = 'file';
    dependencies.inputElement.type = 'file';
    dependencies.timelineRange.type = 'range';
    dependencies.endInput.type = 'number';
    dependencies.startInput.type = 'number';
    dependencies.textElement.id = 'textOverlay';
    Object.defineProperty(dependencies.videoElement, 'duration', { value: 20, configurable: true });

    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.audioInput);
    document.body.appendChild(dependencies.inputElement);
    document.body.appendChild(dependencies.textElement);
    document.body.appendChild(dependencies.timelineRange);
    document.body.appendChild(dependencies.currentTime);
    document.body.appendChild(dependencies.duration);
    document.body.appendChild(dependencies.playPauseBtn);
    document.body.appendChild(dependencies.endInput);
    document.body.appendChild(dependencies.startInput);

    global.URL.createObjectURL = jest.fn(() => 'mocked-url');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('should load single video correctly', () => {
    const editor = new VideoEditor(dependencies);
    const mockFile = new File([''], 'video.mp4', { type: 'video/mp4' });

    editor.loadVideos([mockFile]);

    expect(dependencies.videoElement.src).toBe('mocked-url');
    expect(dependencies.debugElement.textContent).toBe('Status: Video loaded, duration 20 sec');
  });

  test('should apply filter correctly', () => {
    const editor = new VideoEditor(dependencies);
    editor.applyFilter('grayscale');

    expect(dependencies.videoElement.style.filter).toBe('grayscale(100%)');
    expect(dependencies.debugElement.textContent).toBe('Status: Applied filter grayscale');
  });

  test('should apply text correctly', () => {
    const editor = new VideoEditor(dependencies);
    editor.applyText('Test Text', 'top-left', '#ff0000', '24');

    expect(dependencies.textElement.textContent).toBe('Test Text');
    expect(dependencies.textElement.style.display).toBe('block');
    expect(dependencies.textElement.style.color).toBe('rgb(255, 0, 0)');
    expect(dependencies.textElement.style.fontSize).toBe('24px');
    expect(dependencies.textElement.style.top).toBe('10px');
    expect(dependencies.textElement.style.left).toBe('10px');
    expect(dependencies.debugElement.textContent).toBe('Status: Text "Test Text" added at top-left');
  });
});