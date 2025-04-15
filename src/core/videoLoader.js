export class VideoLoader {
  constructor(inputElement, videoElement, debugElement) {
    this.inputElement = inputElement;
    this.videoElement = videoElement;
    this.debugElement = debugElement;
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
          this.debugElement.textContent = `Статус: Видео загружено, длительность ${this.videoElement.duration} сек`;
          const endInput = document.getElementById('end');
          endInput.max = this.videoElement.duration;
          endInput.value = this.videoElement.duration;
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
}