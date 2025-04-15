import { VideoMerger } from '../videoMerger.js';

describe('VideoMerger', () => {
  let videoElement, debugElement, timelineRange, currentTime, duration;

  beforeEach(() => {
    videoElement = document.createElement('video');
    debugElement = document.createElement('p');
    timelineRange = document.createElement('input');
    timelineRange.type = 'range';
    currentTime = document.createElement('span');
    duration = document.createElement('span');

    document.body.appendChild(videoElement);
    document.body.appendChild(debugElement);
    document.body.appendChild(timelineRange);
    document.body.appendChild(currentTime);
    document.body.appendChild(duration);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should merge videos and update timeline', async () => {
    const merger = new VideoMerger(videoElement, debugElement, timelineRange, currentTime, duration);
    const mockFile1 = new File([''], 'video1.mp4', { type: 'video/mp4' });
    const mockFile2 = new File([''], 'video2.mp4', { type: 'video/mp4' });

    // Мокаем длительность видео
    const tempVideo1 = document.createElement('video');
    tempVideo1.src = URL.createObjectURL(mockFile1);
    Object.defineProperty(tempVideo1, 'duration', { value: 5, writable: true });

    const tempVideo2 = document.createElement('video');
    tempVideo2.src = URL.createObjectURL(mockFile2);
    Object.defineProperty(tempVideo2, 'duration', { value: 3, writable: true });

    await merger.mergeVideos([mockFile1, mockFile2]);

    expect(merger.totalDuration).toBe(8); // 5 + 3 = 8 секунд
    expect(timelineRange.max).toBe(8);
    expect(duration.textContent).toBe('0:08');
    expect(debugElement.textContent).toBe('Status: Videos merged');
  });
});