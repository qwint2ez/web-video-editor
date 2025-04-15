import { VideoTrimmer } from '../videoTrimmer.js';

describe('VideoTrimmer', () => {
  let videoElement, debugElement, timelineRange, currentTime, duration;

  beforeEach(() => {
    // Создаем моковые элементы
    videoElement = document.createElement('video');
    videoElement.duration = 20; // Длительность видео 20 секунд
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
    expect(() => trimmer.applyTrim(5, 3)).toThrow('End time must be greater than start time');
    expect(debugElement.textContent).toBe('Status: Error! End time must be greater than start time');
  });

  test('should throw error if time range is invalid', () => {
    const trimmer = new VideoTrimmer(videoElement, debugElement, timelineRange, currentTime, duration);
    expect(() => trimmer.applyTrim(-1, 5)).toThrow('Invalid time range');
    expect(debugElement.textContent).toBe('Status: Error! Invalid time range');
  });

  test('should trim video correctly', () => {
    const trimmer = new VideoTrimmer(videoElement, debugElement, timelineRange, currentTime, duration);
    trimmer.applyTrim(2, 10);

    expect(trimmer.isTrimmed).toBe(true);
    expect(trimmer.startTime).toBe(2);
    expect(trimmer.endTime).toBe(10);
    expect(timelineRange.max).toBe('8'); // 10 - 2 = 8 секунд
    expect(duration.textContent).toBe('0:08');
    expect(debugElement.textContent).toBe('Status: Video trimmed from 2 to 10 sec');
  });
});