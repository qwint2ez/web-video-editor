export class VideoTrimmer {
  constructor(sourceVideo, trimmedVideo, debugElement) {
    this.sourceVideo = sourceVideo;
    this.trimmedVideo = trimmedVideo;
    this.debugElement = debugElement;
    this.startTime = 0;
    this.endTime = 0;
    this.isTrimmed = false;
  }

  applyTrim(startTime, endTime) {
    if (endTime <= startTime) {
      this.debugElement.textContent = 'Статус: Ошибка! Конец должен быть позже начала';
      throw new Error('Конец должен быть позже начала');
    }
    if (startTime < 0 || endTime > this.sourceVideo.duration) {
      this.debugElement.textContent = 'Статус: Ошибка! Неверный диапазон времени';
      throw new Error('Неверный диапазон времени');
    }

    this.startTime = startTime;
    this.endTime = endTime;
    this.isTrimmed = true;

    this.trimmedVideo.src = this.sourceVideo.src;
    this.trimmedVideo.currentTime = this.startTime;

    this.trimmedVideo.addEventListener('timeupdate', () => {
      if (this.isTrimmed) {
        if (this.trimmedVideo.currentTime >= this.endTime) {
          this.trimmedVideo.pause();
          this.trimmedVideo.currentTime = this.startTime;
        }
        if (this.trimmedVideo.currentTime < this.startTime) {
          this.trimmedVideo.currentTime = this.startTime;
        }
      }
    });

    this.debugElement.textContent = `Статус: Видео обрезано с ${this.startTime} до ${this.endTime} сек`;
  }

  getTrimmedInfo() {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      isTrimmed: this.isTrimmed
    };
  }
}