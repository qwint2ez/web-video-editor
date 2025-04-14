export class VideoTrimmer {
  constructor(videoElement, debugElement, timelineRange, currentTime, duration) {
    this.videoElement = videoElement;
    this.debugElement = debugElement;
    this.timelineRange = timelineRange;
    this.currentTime = currentTime;
    this.duration = duration;
    this.startTime = 0;
    this.endTime = 0;
    this.isTrimmed = false;
  }

  applyTrim(startTime, endTime) {
    if (endTime <= startTime) {
      this.debugElement.textContent = 'Status: Error! End time must be greater than start time';
      throw new Error('End time must be greater than start time');
    }
    if (startTime < 0 || endTime > this.videoElement.duration) {
      this.debugElement.textContent = 'Status: Error! Invalid time range';
      throw new Error('Invalid time range');
    }

    this.startTime = startTime;
    this.endTime = endTime;
    this.isTrimmed = true;

    this.videoElement.currentTime = this.startTime;
    const trimmedDuration = endTime - startTime;
    this.timelineRange.max = trimmedDuration;
    this.duration.textContent = this.formatTime(trimmedDuration);

    this.videoElement.addEventListener('timeupdate', () => {
      if (this.isTrimmed) {
        if (this.videoElement.currentTime >= this.endTime) {
          this.videoElement.pause();
          this.videoElement.currentTime = this.startTime;
          document.getElementById('playPauseBtn').textContent = 'Play';
        }
        if (this.videoElement.currentTime < this.startTime) {
          this.videoElement.currentTime = this.startTime;
        }
      }
    });

    this.debugElement.textContent = `Status: Video trimmed from ${this.startTime} to ${this.endTime} sec`;
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }
}