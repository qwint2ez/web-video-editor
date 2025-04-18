import { VideoTrimmer } from '../core/videoTrimmer.js';

describe('VideoTrimmer', () => {
  let videoElement, debugElement, timelineRange, currentTime, duration;

  beforeEach(() => {
    videoElement = document.createElement('video');
    Object.defineProperty(videoElement, 'duration', { value: 20, configurable: true });
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

  test('should throw error if end time is less than start time', () => {
    const trimmer = new VideoTrimmer(videoElement, debugElement, timelineRange, currentTime, duration);
    expect(() => trimmer.process(5, 3)).toThrow('End time must be greater than start time');
    expect(debugElement.textContent).toBe('Status: Error! End time must be greater than start time');
  });

  test('should throw error if time range is invalid', () => {
    const trimmer = new VideoTrimmer(videoElement, debugElement, timelineRange, currentTime, duration);
    expect(() => trimmer.process(-1, 5)).toThrow('Invalid time range');
    expect(debugElement.textContent).toBe('Status: Error! Invalid time range');
  });

  test('should trim video correctly', () => {
    const trimmer = new VideoTrimmer(videoElement, debugElement, timelineRange, currentTime, duration);
    trimmer.process(2, 10);
    expect(trimmer.isTrimmedState).toBe(true);
    expect(trimmer.startTimeValue).toBe(2);
    expect(trimmer.endTime).toBe(10);
    expect(timelineRange.max).toBe('8');
    expect(duration.textContent).toBe('0:08');
    expect(debugElement.textContent).toBe('Status: Video trimmed from 2 to 10 sec');
  });
});