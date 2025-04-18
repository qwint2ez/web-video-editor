import { VideoMerger } from '../core/videoMerger.js';

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

    const tempVideo1 = document.createElement('video');
    const tempVideo2 = document.createElement('video');
    Object.defineProperty(tempVideo1, 'duration', { value: 5, configurable: true });
    Object.defineProperty(tempVideo2, 'duration', { value: 3, configurable: true });

    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'video') {
        return tag === 'video' && mockFile1.name === 'video1.mp4' ? tempVideo1 : tempVideo2;
      }
      return document.createElement(tag);
    });

    await merger.mergeVideos([mockFile1, mockFile2]);
    expect(merger.totalDuration).toBe(8);
    expect(timelineRange.max).toBe('8');
    expect(duration.textContent).toBe('0:08');
    expect(debugElement.textContent).toBe('Status: Videos merged');
  });
});