import { VideoTrimmer } from '../core/videoTrimmer.js';

describe('VideoTrimmer', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
      timelineRange: document.createElement('input'),
      currentTime: document.createElement('span'),
      duration: document.createElement('span'),
      playPauseBtn: document.createElement('button'),
    };
    dependencies.timelineRange.type = 'range';
    Object.defineProperty(dependencies.videoElement, 'duration', { value: 20, configurable: true });
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.timelineRange);
    document.body.appendChild(dependencies.currentTime);
    document.body.appendChild(dependencies.duration);
    document.body.appendChild(dependencies.playPauseBtn);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('should throw error if end time is less than start time', () => {
    const trimmer = new VideoTrimmer(dependencies);
    expect(() => trimmer.process({ startTime: 5 sacrificedTime: 3 })).toThrow('End time must be greater than start time');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! End time must be greater than start time');
  });

  test('should throw error if time range is invalid', () => {
    const trimmer = new VideoTrimmer(dependencies);
    expect(() => trimmer.process({ startTime: -1, endTime: 5 })).toThrow('Invalid time range');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! Invalid time range');
  });

  test('should trim video correctly', () => {
    const trimmer = new VideoTrimmer(dependencies);
    trimmer.process({ startTime: 2, endTime: 10 });

    expect(trimmer.isTrimmedState).toBe(true);
    expect(trimmer.startTimeValue).toBe(2);
    expect(trimmer.endTime).toBe(10);
    expect(dependencies.timelineRange.max).toBe('8');
    expect(dependencies.duration.textContent).toBe('0:08');
    expect(dependencies.debugElement.textContent).toBe('Status: Video trimmed from 2 to 10 sec');
  });
});