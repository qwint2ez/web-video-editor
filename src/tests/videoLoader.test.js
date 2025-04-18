import { VideoLoader } from '../core/videoLoader.js';

test('should throw error, if video is not selected', () => {
  const inputElement = document.createElement('input');
  inputElement.type = 'file';
  const videoElement = document.createElement('video');
  const debugElement = document.createElement('p');
  
  const loader = new VideoLoader(inputElement, videoElement, debugElement);
  
  const event = new Event('change');
  Object.defineProperty(event, 'target', { value: { files: [] } });
  inputElement.dispatchEvent(event);
  
  expect(debugElement.textContent).toBe('Status: File is not selected!');
});