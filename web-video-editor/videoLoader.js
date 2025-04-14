export class VideoLoader {
  constructor(inputElement, videoElement, debugElement) {
    this.inputElement = inputElement;
    this.videoElement = videoElement;
    this.debugElement = debugElement;
    this.duration = 0;
    this.bindEvents();
  }

  bindEvents() {
    this.inputElement.addEventListener('change', (e) => {
      this.debugElement.textContent = 'Статус: Загружаем видео...';
      const file = e.target.files[0];
      if (file) {
        const videoURL = URL.createObjectURL(file);
        this.videoElement.src = videoURL;
        this.videoElement.onloadedmetadata = () => {
          this.duration = this.videoElement.duration;
          this.debugElement.textContent = `Статус: Видео загружено, длительность ${this.duration} сек`;
          const endInput = document.getElementById('end');
          endInput.max = this.duration;
          endInput.value = this.duration;
          document.getElementById('start').value = 0;
        };
        this.videoElement.onerror = () => {
          this.debugElement.textContent = 'Статус: Ошибка загрузки видео!';
        };
      } else {
        this.debugElement.textContent = 'Статус: Файл не выбран!';
      }
    });
  }

  getDuration() {
    return this.duration;
  }

  getVideoElement() {
    return this.videoElement;
  }
}