import { VideoLoader } from '../core/videoLoader.js';

describe('VideoLoader', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
      inputElement: document.createElement('input'),
      endInput: document.createElement('input'),
      startInput: document.createElement('input'),
    };
    dependencies.inputElement.type = 'file';
    dependencies.endInput.type = 'number';
    dependencies.startInput.type = 'number';
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.inputElement);
    document.body.appendChild(dependencies.endInput);
    document.body.appendChild(dependencies.startInput);

    global.URL.createObjectURL = jest.fn(() => 'mocked-video-url');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('should throw error if no file is selected', () => {
    const loader = new VideoLoader(dependencies);
    expect(() => loader.process({ file: null })).toThrow('File is not selected');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! File is not selected');
  });

  test('should load video correctly', () => {
    const loader = new VideoLoader(dependencies);
    const mockFile = new File([''], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(dependencies.videoElement, 'duration', { value: 20, configurable: true });

    loader.process({ file: mockFile });

    expect(dependencies.videoElement.src).toBe('mocked-video-url');
    dependencies.videoElement.onloadedmetadata();
    expect(dependencies.debugElement.textContent).toBe('Status: Video loaded, duration 20 sec');
    expect(dependencies.endInput.max).toBe(20);
    expect(dependencies.endInput.value).toBe(20);
    expect(dependencies.startInput.value).toBe('0');
  });
});