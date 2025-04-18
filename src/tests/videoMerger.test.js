import { VideoMerger } from '../core/videoMerger.js';

describe('VideoMerger', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
      timelineRange: document.createElement('input'),
      currentTime: document.createElement('span'),
      duration: document.createElement('span'),
    };
    dependencies.timelineRange.type = 'range';
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.timelineRange);
    document.body.appendChild(dependencies.currentTime);
    document.body.appendChild(dependencies.duration);

    global.URL.createObjectURL = jest.fn(() => 'mocked-video-url');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('should throw error if there is less than two videos', async () => {
    const merger = new VideoMerger(dependencies);
    const mockFile = new File([''], 'video1.mp4', { type: 'video/mp4' });

    await expect(merger.process({ videoFiles: [mockFile] })).rejects.toThrow('Select at least two videos');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! Select at least two videos');
  });

  test('should merge videos correctly', async () => {
    const merger = new VideoMerger(dependencies);
    const mockFile1 = new File([''], 'video1.mp4', { type: 'video/mp4' });
    const mockFile2 = new File([''], 'video2.mp4', { type: 'video/mp4' });

    // Мокаем длительность видео
    const mockVideo = document.createElement('video');
    jest.spyOn(document, 'createElement').mockReturnValue(mockVideo);
    mockVideo.onloadedmetadata = null;
    Object.defineProperty(mockVideo, 'duration', { value: 10, configurable: true });

    await merger.process({ videoFiles: [mockFile1, mockFile2] });

    expect(merger.videos).toHaveLength(2);
    expect(merger.totalDuration).toBe(20);
    expect(dependencies.videoElement.src).toBe('mocked-video-url');
    expect(dependencies.debugElement.textContent).toBe('Status: Videos merged');
  });
});