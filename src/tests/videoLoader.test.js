import { VideoLoader } from '../core/videoLoader.js';

describe('VideoLoader', () => {
  let videoElement, debugElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
    debugElement = document.createElement('p');
    document.body.appendChild(videoElement);
    document.body.appendChild(debugElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if invalid video file is provided', () => {
    const loader = new VideoLoader(videoElement, debugElement);
    const invalidFile = new File([''], 'text.txt', { type: 'text/plain' });
    expect(() => loader.loadVideo(invalidFile)).toThrow('Invalid video file');
    expect(debugElement.textContent).toBe('Status: Error! Invalid video file');
  });

  test('should load video correctly', () => {
    const loader = new VideoLoader(videoElement, debugElement);
    const mockFile = new File([''], 'video.mp4', { type: 'video/mp4' });
    global.URL.createObjectURL = jest.fn(() => 'mocked-url');
    loader.loadVideo(mockFile);
    expect(videoElement.src).toBe('mocked-url');
    expect(debugElement.textContent).toBe('Status: Video loaded');
  });
});