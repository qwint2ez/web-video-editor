// Получаем элементы DOM
const videoInput = document.getElementById('videoInput');
const video = document.getElementById('video');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const trimBtn = document.getElementById('trimBtn');

// Функция загрузки видео
videoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const videoURL = URL.createObjectURL(file);
    video.src = videoURL;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      endInput.max = duration; // Устанавливаем максимальное значение конца
      endInput.value = duration; // По умолчанию конец = длительность видео
    };
  }
});

// Функция обрезки видео
function trimVideo(startTime, endTime) {
  video.currentTime = startTime; // Устанавливаем начало
  video.play(); // Запускаем воспроизведение

  const interval = setInterval(() => {
    if (video.currentTime >= endTime) {
      video.pause(); // Останавливаем на конце
      clearInterval(interval); // Убираем проверку
    }
  }, 100); // Проверяем каждые 100 мс
}

// Обработчик кнопки обрезки
trimBtn.addEventListener('click', () => {
  const startTime = parseFloat(startInput.value);
  const endTime = parseFloat(endInput.value);
  if (endTime <= startTime) {
    alert('Время конца должно быть больше времени начала!');
    return;
  }
  trimVideo(startTime, endTime);
});