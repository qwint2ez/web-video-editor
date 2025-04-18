import { VideoMerger } from '../core/VideoMerger.js';

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
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.timelineRange);
    document.body.appendChild(dependencies.currentTime);
    document.body.appendChild(dependencies.duration);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if there is less than two videos', () => {
    const merger = new VideoMerger(dependencies);
    const mockFile = new File([''], 'video1.mp4', { type: 'video/mp4' });
    expect(() => merger.process({ videoFiles: [mockFile] })).toThrow('Select at least two videos');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! Select at least two videos');
  });
});