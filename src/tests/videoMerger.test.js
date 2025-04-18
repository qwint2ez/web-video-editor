import { VideoMerger } from '../core/videoMerger.js';

test('should throw error if there is less than two videos', () => {
  const videoElement = document.createElement('video');
  const debugElement = document.createElement('p');
  const timelineRange = document.createElement('input');
  const currentTime = document.createElement('span');
  const duration = document.createElement('span');
  
  const merger = new VideoMerger(videoElement, debugElement, timelineRange, currentTime, duration);
  
  const mockFile = new File([''], 'video1.mp4', { type: 'video/mp4' });
  
  expect(() => merger.mergeVideos([mockFile])).toThrow('Select at least two videos');
  expect(debugElement.textContent).toBe('Status: Error! Select at least two videos');
});