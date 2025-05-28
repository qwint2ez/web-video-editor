import { VideoEditor } from '../core/videoEditor.js';

// State management
const state = {
    uploadedVideos: [],
    videoEditor: null
};

// Единый объект для всех DOM элементов
const elements = {
    videoElement: document.getElementById('processedVideo'),
    debugElement: document.getElementById('debug'),
    textOverlay: document.getElementById('textOverlay'),
    timelineBar: document.getElementById('timelineBar'),
    timelineRange: document.getElementById('timelineRange'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    
    // Кнопки управления
    playPauseBtn: document.getElementById('playPauseBtn'),
    muteBtn: document.getElementById('muteBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    
    // Контролы редактирования
    videoInput: document.getElementById('videoInput'),
    audioInput: document.getElementById('audioInput'),
    startInput: document.getElementById('start'),
    endInput: document.getElementById('end'),
    addToTimelineBtn: document.getElementById('addToTimelineBtn'),
    
    // Контейнеры
    uploadedVideosSection: document.getElementById('uploadedVideosSection'),
    uploadedVideosList: document.getElementById('uploadedVideosList'),
    editorContainer: document.querySelector('.editor-container'),
    controlsContainer: document.querySelector('.controls-container'),
    videoContainer: document.querySelector('.video-container'),
    timelineContainer: document.querySelector('.timeline-container'),
    controlsSection: document.querySelector('.controls-section'),

    // Ползунок громкости
    volumeSlider: document.getElementById('volumeSlider')
};

// Инициализация плеера
function initializePlayerControls() {
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', () => {
            const merger = state.videoEditor.processors.merger;
            if (merger) {
                merger.togglePlay();
            }
        });
    }

    if (elements.downloadBtn) {
        elements.downloadBtn.addEventListener('click', async () => {
            try {
                utils.showStatus('Подготовка и объединение видео...');
                const merger = state.videoEditor.processors.merger;
                
                if (!merger || !merger.videos.length) {
                    throw new Error('Нет видео для скачивания');
                }

                // Объединяем видео и скачиваем
                const videoBlob = await merger.exportVideo();
                const url = URL.createObjectURL(videoBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'merged-video.mp4';
                link.click();
                URL.revokeObjectURL(url);
                
                utils.showStatus('Видео успешно скачано');
            } catch (error) {
                utils.showError('Ошибка при скачивании: ' + error.message);
            }
        });
    }
}

// Вспомогательные функции
const utils = {
    showError: (message) => {
        elements.debugElement.textContent = `Статус: Ошибка! ${message}`;
    },
    showStatus: (message) => {
        elements.debugElement.textContent = `Статус: ${message}`;
    },
    showElement: (element) => element?.classList.remove('hidden'),
    hideElement: (element) => element?.classList.add('hidden')
};

// Функции обновления UI
function updateTimelineProgress() {
    const current = state.videoEditor.getCurrentTime();
    const duration = elements.videoElement?.duration || 0;
    const progress = document.querySelector('.timeline-progress');
    
    if (progress && duration > 0) {
        progress.style.width = `${(current / duration) * 100}%`;
    }
    
    if (elements.currentTime) {
        elements.currentTime.textContent = state.videoEditor.formatTime(current);
    }
    
    if (elements.timelineRange) {
        elements.timelineRange.value = current.toString();
    }
}

function renderTimelineBar(videoDurations) {
    const timelineBar = elements.timelineBar;
    if (!timelineBar) return;
    
    timelineBar.innerHTML = '';
    
    // Создаем индикатор прогресса
    const progress = document.createElement('div');
    progress.className = 'timeline-progress';
    timelineBar.appendChild(progress);
    
    const colors = ['#74b9ff', '#55efc4', '#ffeaa7', '#fd79a8', '#fab1a0', '#a29bfe', '#fdcb6e'];
    const total = videoDurations.reduce((a, b) => a + b, 0);
    
    let currentPosition = 0;
    videoDurations.forEach((dur, idx) => {
        const seg = document.createElement('div');
        seg.className = 'timeline-segment';
        const width = (dur / total) * 100;
        seg.style.width = `${width}%`;
        seg.style.left = `${currentPosition}%`;
        seg.style.background = colors[idx % colors.length];
        currentPosition += width;
        
        const videoInfo = state.uploadedVideos[idx];
        if (videoInfo) {
            seg.title = `${videoInfo.name}\nДлительность: ${Math.round(dur)}с`;
        }
        
        timelineBar.appendChild(seg);
    });
}

// Обработчики событий
function handleVideoUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    state.uploadedVideos.length = 0;
    files.forEach(file => {
        state.uploadedVideos.push({ file, name: file.name, selected: true });
    });
    
    utils.showElement(elements.uploadedVideosSection);
    renderUploadedVideosList();
}

function renderUploadedVideosList() {
    if (!elements.uploadedVideosList) return;
    elements.uploadedVideosList.innerHTML = '';
    
    state.uploadedVideos.forEach((file, idx) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.idx = idx;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = file.selected || false;
        checkbox.addEventListener('change', () => {
            file.selected = checkbox.checked;
        });

        const label = document.createElement('span');
        label.textContent = file.name;

        // Drag handle
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', idx);
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });
        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            li.style.background = '#f1f2f6';
        });
        li.addEventListener('dragleave', () => {
            li.style.background = '';
        });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.style.background = '';
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIdx = idx;
            if (fromIdx !== toIdx) {
                const moved = state.uploadedVideos.splice(fromIdx, 1)[0];
                state.uploadedVideos.splice(toIdx, 0, moved);
                
                // Обновляем порядок в VideoMerger
                if (state.videoEditor?.processors.merger) {
                    state.videoEditor.processors.merger.reorderVideos(fromIdx, toIdx);
                }
                
                renderUploadedVideosList();
            }
        });

        li.appendChild(checkbox);
        li.appendChild(label);
        elements.uploadedVideosList.appendChild(li);
    });
}

async function handleAddToTimeline() {
    const selectedVideos = state.uploadedVideos.filter(v => v.selected);
    if (!selectedVideos.length) {
        utils.showError('Выберите хотя бы одно видео');
        return;
    }

    utils.showStatus('Загрузка видео...');
    try {
        // Показываем все необходимые элементы
        const containers = [
            elements.editorContainer,
            elements.videoContainer,
            elements.controlsContainer,
            document.querySelector('.timeline-container'),
            document.querySelector('.controls-section')
        ];
        
        containers.forEach(container => {
            if (container) container.classList.remove('hidden');
        });

        // Загружаем видео
        await state.videoEditor.loadVideos(selectedVideos.map(v => v.file));
        utils.showStatus('Видео загружены успешно');
    } catch (error) {
        utils.showError(error.message);
    }
}

// Инициализация
function initializeApp() {
    try {
        state.videoEditor = new VideoEditor(elements);
        
        // Скрываем элементы управления изначально
        utils.hideElement(elements.editorContainer);
        utils.hideElement(elements.uploadedVideosSection);

        // Добавляем обработчики событий
        elements.videoInput?.addEventListener('change', handleVideoUpload);
        elements.addToTimelineBtn?.addEventListener('click', handleAddToTimeline);
        
        initializePlayerControls();
        
        utils.showStatus('Editor initialized successfully');
    } catch (error) {
        console.error('Failed to initialize:', error);
        utils.showError('Failed to initialize editor');
    }
}

// Добавляем обработчик аудио
function handleAudioUpload(e) {
    const audioFile = e.target?.files?.[0];
    if (!audioFile) {
        utils.showError('No audio file selected');
        return;
    }
    
    try {
        state.videoEditor?.applyAudio(audioFile);
    } catch (error) {
        utils.showError(error.message);
    }
}

// Один единственный слушатель загрузки DOM
document.addEventListener('DOMContentLoaded', initializeApp);

// Обработчики событий редактирования
document.getElementById('applyTrimBtn')?.addEventListener('click', async () => {
    try {
        const merger = state.videoEditor.processors.merger;
        if (!merger || !merger.videos.length) {
            throw new Error('Сначала загрузите видео');
        }

        // Показываем диалог выбора видео
        const selectedIndex = await showVideoSelectionDialog(merger.videos);
        if (selectedIndex === null) return;

        const duration = merger.durations[selectedIndex];
        const startTime = parseFloat(elements.startInput.value) || 0;
        const endTime = parseFloat(elements.endInput.value) || duration;

        if (startTime < 0 || endTime > duration || startTime >= endTime) {
            throw new Error(`Время должно быть между 0 и ${duration.toFixed(1)} секунд`);
        }

        if (confirm(`Обрезать видео ${selectedIndex + 1} с ${startTime}с до ${endTime}с?`)) {
            await merger.trimSingleVideo(selectedIndex, startTime, endTime);
            utils.showStatus('Видео успешно обрезано');
        }
    } catch (error) {
        utils.showError(error.message);
    }
});

// Обновленная функция диалога выбора видео
function showVideoSelectionDialog(videos) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'video-selection-dialog';
        
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Выберите видео для обрезки</h3>
                <div class="video-list">
                    ${videos.map((_, idx) => `
                        <div class="video-item">
                            <button class="video-select-btn" data-index="${idx}">
                                Видео ${idx + 1}
                            </button>
                            <span class="video-duration">
                                (${formatDuration(videos[idx].duration)})
                            </span>
                        </div>
                    `).join('')}
                </div>
                <button class="cancel-btn">Отмена</button>
            </div>
        `;

        dialog.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('video-select-btn')) {
                const index = parseInt(target.dataset.index);
                dialog.remove();
                resolve(index);
            } else if (target.classList.contains('cancel-btn')) {
                dialog.remove();
                resolve(null);
            }
        });

        document.body.appendChild(dialog);
    });
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Обновляем обработчик текста
document.getElementById('applyTextBtn').addEventListener('click', () => {
    const text = document.getElementById('textInput').value;
    const position = document.getElementById('textPosition').value;
    const color = document.getElementById('textColor').value;
    const size = document.getElementById('textSize').value;
    try {
        state.videoEditor.applyText(text, position, color, size);
    } catch (error) {
        elements.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

// Обновляем обработчик фильтров
document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const filter = document.getElementById('filterSelect').value;
    try {
        state.videoEditor.applyFilter(filter);
    } catch (error) {
        elements.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

// Обновляем обработчик аудио
document.getElementById('applyAudioBtn').addEventListener('click', () => {
    try {
        state.videoEditor.applyAudio();
    } catch (error) {
        elements.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});