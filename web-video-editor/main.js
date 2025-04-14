// Получаем элементы DOM
const videoInput = document.getElementById('videoInput');
const video = document.getElementById('video');
const debug = document.getElementById('debug');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const applyBtn = document.getElementById('applyBtn');
const customTimeline = document.getElementById('customTimeline');
const timelineDuration = document.getElementById('timelineDuration');

// Проверяем наличие элементов
if (!videoInput || !video || !debug || !startInput || !endInput || !applyBtn || !customTimeline || !timelineDuration) {
  debug.textContent = 'Статус: Ошибка! Проверь ID элементов в HTML';
  console.error('Ошибка: один из элементов не найден');
  throw new Error('Missing DOM elements');
}

// Локальные данные для обрезки
let trimState = {
  startTime: 0,
  endTime: 0,
  isTrimmed: false,
  originalDuration: 0
};

// Загрузка видео
function loadVideo() {
  videoInput.addEventListener('change', (e) => {
    debug.textContent = 'Статус: Загружаем видео...';
    const file = e.target.files[0];

    if (file) {
      const videoURL = URL.createObjectURL(file);
      video.src = videoURL;

      video.onloadedmetadata = () => {
        trimState.originalDuration = video.duration;
        trimState.endTime = video.duration;
        startInput.value = 0;
        endInput.value = video.duration;
        customTimeline.max = video.duration;
        customTimeline.value = 0;
        timelineDuration.textContent = `${video.duration} сек`;
        debug.textContent = `Статус: Видео загружено, длительность ${video.duration} сек`;
      };

      video.onerror = () => {
        debug.textContent = 'Статус: Ошибка загрузки видео! Проверь формат файла';
        console.error('Ошибка загрузки видео');
      };
    } else {
      debug.textContent = 'Статус: Файл не выбран!';
    }
  });
}

// Синхронизация кастомной шкалы времени
function syncTimeline() {
  customTimeline.addEventListener('input', () => {
    if (trimState.isTrimmed) {
      const timelineValue = parseFloat(customTimeline.value);
      const mappedTime = trimState.startTime + timelineValue;
      video.currentTime = mappedTime;
    } else {
      video.currentTime = parseFloat(customTimeline.value);
    }
  });

  video.addEventListener('timeupdate', () => {
    if (trimState.isTrimmed) {
      const relativeTime = video.currentTime - trimState.startTime;
      customTimeline.value = Math.max(0, Math.min(trimState.endTime - trimState.startTime, relativeTime));
    } else {
      customTimeline.value = video.currentTime;
    }
  });
}

// Применение обрезки
function applyTrim() {
  const startTime = parseFloat(startInput.value);
  const endTime = parseFloat(endInput.value);

  if (isNaN(startTime) || isNaN(endTime)) {
    debug.textContent = 'Статус: Ошибка! Введите корректные числа';
    alert('Введите корректные числа для начала и конца');
    return;
  }

  if (endTime <= startTime) {
    debug.textContent = 'Статус: Ошибка! Конец должен быть позже начала';
    alert('Конец должен быть позже начала');
    return;
  }

  if (startTime < 0 || endTime > trimState.originalDuration) {
    debug.textContent = 'Статус: Ошибка! Неверный диапазон времени';
    alert(`Диапазон должен быть от 0 до ${trimState.originalDuration} сек`);
    return;
  }

  trimState.startTime = startTime;
  trimState.endTime = endTime;
  trimState.isTrimmed = true;

  // Обновляем шк му времени
  const newDuration = endTime - startTime;
  customTimeline.max = newDuration;
  customTimeline.value = 0;
  video.currentTime = startTime;
  timelineDuration.textContent = `${newDuration} сек`;

  debug.textContent = `Статус: Видео обрезано с ${startTime} до ${endTime} сек (длительность ${newDuration} сек)`;
}

// Ограничение воспроизведения
function restrictPlayback() {
  video.addEventListener('timeupdate', () => {
    if (trimState.isTrimmed) {
      if (video.currentTime < trimState.startTime) {
        video.currentTime = trimState.startTime;
      }
      if (video.currentTime >= trimState.endTime) {
        video.pause();
        video.currentTime = trimState.startTime;
      }
    }
  });
}

// Инициализация
loadVideo();
syncTimeline();
restrictPlayback();

applyBtn.addEventListener('click', applyTrim);