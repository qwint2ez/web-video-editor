import { VideoEditor } from '../core/videoEditor.js';

// State management
const state = {
    uploadedMedia: [],
    videoEditor: null
};

// Единый объект для всех DOM элементов
const elements = {
    videoElement: document.getElementById('processedVideo'),
    debugElement: document.getElementById('debug'),
    textOverlay: document.getElementById('textOverlay'),
    timelineBar: document.getElementById('timelineBar'),
    // timelineRange: document.getElementById('timelineRange'), // This element might not exist or be used
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    
    // Кнопки управления
    playPauseBtn: document.getElementById('playPauseBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    
    // Контролы редактирования
    videoInput: document.getElementById('videoInput'),
    startInput: document.getElementById('start'),
    endInput: document.getElementById('end'),
    addToTimelineBtn: document.getElementById('addToTimelineBtn'),
    
    // Project Save/Load Buttons
    saveProjectBtn: document.getElementById('saveProjectBtn'),
    loadProjectInput: document.getElementById('loadProjectInput'), // File input for .json
    loadProjectLabel: document.querySelector('label[for="loadProjectInput"]'), // Label for the load project input
    confirmLoadedFilesBtn: document.getElementById('confirmLoadedFilesBtn'), // Button to confirm files for project load

    // Контейнеры
    uploadedMediaSection: document.getElementById('uploadedVideosSection'), // Ensure this ID matches HTML
    uploadedMediaList: document.getElementById('uploadedMediaList'),     // Ensure this ID matches HTML
    editorContainer: document.querySelector('.editor-container'),
    // controlsContainer: document.querySelector('.controls-container'), // This might not be a distinct element
    videoContainer: document.querySelector('.video-container'),
    timelineContainer: document.querySelector('.timeline-container'),
    // controlsSection: document.querySelector('.controls-section'), // This might not be a distinct element

    // Ползунок громкости
    volumeSlider: document.getElementById('volumeSlider')
};

// Инициализация плеера
function initializePlayerControls() {
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', () => {
            // VideoEditor now has a togglePlay method that delegates to merger
            state.videoEditor?.processors?.merger?.togglePlay();
        });
    }

    if (elements.downloadBtn) {
        elements.downloadBtn.addEventListener('click', async () => {
            try {
                // showExportDialog now calls state.videoEditor.exportMedia
                await showExportDialog(); 
            } catch (error) {
                utils.showError('Download error: ' + error.message);
                console.error(error);
            }
        });
    }

    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', () => {
            const videoElement = elements.videoElement; // Directly use the main video element
            if (videoElement) {
                videoElement.volume = elements.volumeSlider.value;
                // AudioOverlay will pick up volume change via 'volumechange' event on videoElement
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

// NEW helper function to manage Save/Load project button visibility
function updateProjectManagementButtons(isEditorActive) {
    if (isEditorActive) {
        utils.showElement(elements.saveProjectBtn);
        utils.hideElement(elements.loadProjectLabel);
        // The input elements.loadProjectInput is display:none via style, so no need to manage its visibility here
    } else {
        utils.hideElement(elements.saveProjectBtn);
        utils.showElement(elements.loadProjectLabel);
    }
}

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
    
    state.uploadedMedia = [];
    files.forEach(file => {
        const type = file.type.startsWith('video/') ? 'video' : 'audio';
        state.uploadedMedia.push({ 
            file, 
            name: file.name, 
            type, 
            selected: true 
        });
    });
    
    utils.showElement(elements.uploadedMediaSection);
    renderUploadedMediaList();
}

function renderUploadedMediaList() {
    const list = document.getElementById('uploadedMediaList');
    if (!list) return;
    
    list.innerHTML = '';
    
    state.uploadedMedia.forEach((media, idx) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.idx = idx;
        li.className = `media-item ${media.type}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = media.selected || false;
        checkbox.addEventListener('change', () => {
            media.selected = checkbox.checked;
        });

        const icon = document.createElement('span');
        icon.className = 'media-icon';
        icon.textContent = media.type === 'video' ? '🎥' : '🎵';

        const label = document.createElement('span');
        label.textContent = media.name;

        li.appendChild(checkbox);
        li.appendChild(icon);
        li.appendChild(label);
        list.appendChild(li);
        
        // Drag and drop event listeners
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
                const moved = state.uploadedMedia.splice(fromIdx, 1)[0];
                state.uploadedMedia.splice(toIdx, 0, moved);
                renderUploadedMediaList();
            }
        });
    });
}

async function handleAddToTimeline() {
    const selectedMediaFiles = state.uploadedMedia.filter(m => m.selected);
    
    utils.showStatus('Loading media...');
    try {
        const videos = selectedMediaFiles.filter(m => m.type === 'video').map(m => m.file);
        const audioFile = selectedMediaFiles.find(m => m.type === 'audio')?.file;
        
        await state.videoEditor.loadVideos(videos, audioFile); 

        updateTotalDurationDisplay(); 

        const editorIsActive = state.videoEditor?.processors?.merger?.hasMedia() ?? false;
        updateProjectManagementButtons(editorIsActive);

        if (editorIsActive) {
            utils.showElement(elements.editorContainer);
            utils.showStatus('Timeline updated successfully.');
        } else {
            utils.hideElement(elements.editorContainer);
            utils.showStatus('Timeline empty. Add media or load a project.');
        }

    } catch (error) {
        utils.showError(error.message);
        console.error(error);
        const editorIsActiveOnError = state.videoEditor?.processors?.merger?.hasMedia() ?? false;
        updateProjectManagementButtons(editorIsActiveOnError);
        utils.hideElement(elements.editorContainer); // Ensure editor is hidden on error
    }
}

function updateTotalDurationDisplay() {
    const merger = state.videoEditor?.processors?.merger;
    if (merger && elements.duration) {
        elements.duration.textContent = state.videoEditor.formatTime(merger.totalDuration); // Use VideoEditor's formatTime
    } else if (elements.duration) {
        elements.duration.textContent = "00:00";
    }
}

// --- Project Save/Load Logic ---
async function handleSaveProject() {
    if (!state.videoEditor) {
        utils.showError("Editor not initialized.");
        return;
    }
    try {
        utils.showStatus("Saving project...");
        const projectJson = await state.videoEditor.saveProject();
        const blob = new Blob([projectJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video_project_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        utils.showStatus("Project saved successfully.");
    } catch (error) {
        utils.showError("Failed to save project: " + error.message);
        console.error("Save project error:", error);
    }
}

let requiredFilesForLoad = null;

async function handleLoadProjectFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!state.videoEditor) {
        utils.showError("Editor not initialized.");
        return;
    }
    // Reset file input to allow loading the same file again if needed
    event.target.value = null; 

    try {
        utils.showStatus("Reading project file...");
        const jsonContent = await file.text();
        const prepResult = await state.videoEditor.prepareLoadProject(jsonContent);
        
        if (prepResult && prepResult.files && prepResult.files.length > 0) {
            requiredFilesForLoad = prepResult.files;
            utils.showStatus(`Project requires files: ${requiredFilesForLoad.join(', ')}. Please upload ALL listed files using the 'Upload Video/Audio' input, then click 'Confirm Files for Project'.`);
            utils.showElement(elements.confirmLoadedFilesBtn);
            utils.showElement(elements.videoInput); // Ensure video input is visible
             // Clear current uploaded media list in UI to avoid confusion, user needs to re-select
            state.uploadedMedia = [];
            renderUploadedMediaList();
        } else if (prepResult && (!prepResult.files || prepResult.files.length === 0)) {
            // Project has no external file dependencies (e.g. empty project, or only text/filter)
            requiredFilesForLoad = []; // or null
            await state.videoEditor.finalizeLoadProject({}); // Pass empty fileMap
            utils.showStatus("Project loaded (no external files needed or found).");
            utils.hideElement(elements.confirmLoadedFilesBtn);
        } else {
             utils.showError("Project file processed, but no files listed as required. Finalize if this is correct or check project file.");
        }

    } catch (error) {
        utils.showError("Failed to load project: " + error.message);
        console.error("Load project error:", error);
        requiredFilesForLoad = null;
        utils.hideElement(elements.confirmLoadedFilesBtn);
    }
}

async function handleConfirmLoadedFiles() {
    if (!requiredFilesForLoad) {
        utils.showError("No project prepared for loading files.");
        return;
    }
    if (!state.videoEditor) {
        utils.showError("Editor not initialized.");
        return;
    }

    utils.showStatus("Verifying files for project...");
    const fileMap = {};
    let allFilesFound = true;

    for (const requiredName of requiredFilesForLoad) {
        const foundMedia = state.uploadedMedia.find(m => m.name === requiredName);
        if (foundMedia) {
            fileMap[requiredName] = foundMedia.file;
        } else {
            allFilesFound = false;
            utils.showError(`Missing required file: ${requiredName}. Please upload it and try again.`);
            console.warn(`Missing required file for project load: ${requiredName}`);
            break; 
        }
    }

    let editorIsActiveAfterLoad = false;
    if (allFilesFound) {
        try {
            await state.videoEditor.finalizeLoadProject(fileMap);
            // finalizeLoadProject calls updateUIAfterMediaLoad, which shows/hides editorContainer
            editorIsActiveAfterLoad = state.videoEditor?.processors?.merger?.hasMedia() ?? false;
            // Success message is handled by finalizeLoadProject
        } catch (error) {
            // Error message is handled by finalizeLoadProject or caught here
            utils.showError("Error during project finalization: " + error.message);
            console.error("Finalize project load error:", error);
            editorIsActiveAfterLoad = false; // Ensure editor is not considered active
        }
    } else {
        if (requiredFilesForLoad.length > 0 && Object.keys(fileMap).length < requiredFilesForLoad.length) {
             utils.showError("Not all required files were provided or matched. Please check uploads and names.");
        }
        editorIsActiveAfterLoad = false; // Editor not active if files are missing
    }
    
    updateProjectManagementButtons(editorIsActiveAfterLoad);

    if (editorIsActiveAfterLoad) {
        utils.showElement(elements.editorContainer);
    } else {
        utils.hideElement(elements.editorContainer);
    }
    
    // Clean up after attempt
    requiredFilesForLoad = null;
    utils.hideElement(elements.confirmLoadedFilesBtn);
    // Optionally, clear state.uploadedMedia again or leave it for user to manage
    // state.uploadedMedia = [];
    // renderUploadedMediaList();
}


// Инициализация
function initializeApp() {
    try {
        // Clear existing src from video element to prevent issues with old blob URLs on reload
        if (elements.videoElement) {
            elements.videoElement.src = '';
        }

        state.videoEditor = new VideoEditor(elements);
        
        // Скрываем элементы управления изначально
        utils.hideElement(elements.editorContainer);
        utils.hideElement(elements.uploadedMediaSection);
        utils.hideElement(elements.confirmLoadedFilesBtn); // Hide confirm button initially

        // Добавляем обработчики событий
        elements.videoInput?.addEventListener('change', handleVideoUpload);
        elements.addToTimelineBtn?.addEventListener('click', handleAddToTimeline);
        
        // Project Save/Load handlers
        elements.saveProjectBtn?.addEventListener('click', handleSaveProject);
        elements.loadProjectInput?.addEventListener('change', handleLoadProjectFile);
        elements.confirmLoadedFilesBtn?.addEventListener('click', handleConfirmLoadedFiles);
        
        initializePlayerControls();
        updateProjectManagementButtons(false); // Initial state: editor not active
        
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
        const merger = state.videoEditor?.processors?.merger;

        if (!merger) throw new Error('Видеоредактор не инициализирован');
        if (!merger.videos || merger.videos.length === 0) throw new Error('Сначала загрузите видео для обрезки');

        const startTimeInput = parseFloat(elements.startInput.value);
        const endTimeInput = parseFloat(elements.endInput.value);

        let videoIndexToTrim = 0;
        if (merger.videos.length > 1) {
            const selectedIndex = await showVideoSelectionDialog(merger.videos, merger.durations); // Pass durations
            if (selectedIndex === null) return; // User cancelled
            videoIndexToTrim = selectedIndex;
        }
        
        const videoToTrimDuration = merger.durations[videoIndexToTrim];
        if (!Number.isFinite(videoToTrimDuration) || videoToTrimDuration <= 0) {
            throw new Error(`Невозможно определить длительность видео ${videoIndexToTrim + 1}`);
        }

        const start = Number.isFinite(startTimeInput) ? startTimeInput : 0;
        // If endTimeInput is 0 or not a number, use the full duration of the segment
        const end = Number.isFinite(endTimeInput) && endTimeInput > start ? endTimeInput : videoToTrimDuration;


        if (start < 0 || end > videoToTrimDuration || start >= end) {
            throw new Error(`Время для обрезки видео ${videoIndexToTrim + 1} (длит: ${videoToTrimDuration.toFixed(1)}с) некорректно. Start: ${start}, End: ${end}`);
        }
        
        if (confirm(`Обрезать видео ${videoIndexToTrim + 1} с ${start.toFixed(2)}с до ${end.toFixed(2)}с?`)) {
            // Call the new method in VideoEditor
            await state.videoEditor.trimSingleVideo(videoIndexToTrim, start, end);
            // updateTotalDurationDisplay is called inside trimSingleVideo via loadMediaDurations and UI updates
        }
        
    } catch (error) {
        utils.showError(error.message);
        console.error(error);
    }
});

// Обновленная функция диалога выбора видео
function showVideoSelectionDialog(videos, durations) { // Added durations parameter
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'video-selection-dialog';
        
        const videoDurationsFormatted = durations.map(d => formatDuration(d)); // Use existing formatDuration
        
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Выберите видео для обрезки</h3>
                <div class="video-list">
                    ${videos.map((video, idx) => `
                        <div class="video-item">
                            <button class="video-select-btn" data-index="${idx}">
                                Видео ${idx + 1} (${video.name ? video.name.substring(0,15)+'...' : 'Blob'})
                            </button>
                            <span class="video-duration">
                                (${videoDurationsFormatted[idx]})
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

// Обновленная функция форматирования времени
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Обновляем обработчик текста
document.getElementById('applyTextBtn').addEventListener('click', () => {
    const textInput = document.getElementById('textInput');
    const text = textInput ? textInput.value : '';
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
    const filterSelect = document.getElementById('filterSelect');
    const filter = filterSelect ? filterSelect.value : '';
    try {
        state.videoEditor.applyFilter(filter);
    } catch (error) {
        elements.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

// Удаляем обработчик аудио
document.getElementById('applyAudioBtn')?.removeEventListener('click', () => {});
document.getElementById('applyAudioBtn')?.classList.add('hidden');

// Remove the specific audio controls section if it's still there by mistake
const applyAudioBtnContainer = document.getElementById('applyAudioBtn')?.closest('.controls');
if (applyAudioBtnContainer && applyAudioBtnContainer.querySelector('h3')?.textContent === 'Audio') {
    applyAudioBtnContainer.remove();
}

// Обновленная функция диалога экспорта с поддержкой MP4
function showExportDialog() {
    return new Promise((resolvePromise) => { // Renamed resolve to avoid conflict
        const dialog = document.createElement('div');
        dialog.className = 'export-dialog';
        
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Параметры экспорта</h3>
                
                <div class="export-options">
                    <div class="option-group">
                        <label for="formatSelect">Формат видео:</label>
                        <select id="formatSelect">
                            <option value="mp4">MP4 (H.264 + AAC, лучшая совместимость)</option>
                            <option value="webm">WebM (VP9 + Opus, для веб)</option>
                        </select>
                        <small id="formatNote">MP4 обеспечивает лучшую совместимость с большинством устройств</small>
                    </div>
                    
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="includeOriginalAudio" checked>
                            Включить оригинальный звук видео
                        </label>
                    </div>
                    
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="includeOverlayAudio" checked>
                            Включить наложенный звук
                        </label>
                    </div>
                    
                    <div class="option-group">
                        <label for="qualitySelect">Качество:</label>
                        <select id="qualitySelect">
                            <option value="low">Низкое (быстрый экспорт)</option>
                            <option value="medium" selected>Среднее (рекомендуется)</option>
                            <option value="high">Высокое (лучшее качество)</option>
                        </select>
                    </div>
                </div>
                
                <div class="dialog-buttons">
                    <button class="export-btn" id="startExportBtn">Начать экспорт</button>
                    <button class="cancel-btn" id="cancelExportBtn">Отмена</button>
                </div>
                
                <div class="export-info">
                    <small>
                        <strong>Примечание:</strong> Экспорт сохраняет оригинальный звук из видео.
                        MP4 рекомендуется для лучшей совместимости.
                    </small>
                </div>
            </div>
        `;

        // Обновляем подсказку при смене формата
        const formatSelect = dialog.querySelector('#formatSelect');
        const formatNote = dialog.querySelector('#formatNote');
        
        formatSelect.addEventListener('change', () => {
            if (formatSelect.value === 'mp4') {
                formatNote.textContent = 'MP4 обеспечивает лучшую совместимость с большинством устройств';
            } else {
                formatNote.textContent = 'WebM оптимизирован для веб-использования';
            }
        });

        const startExport = async () => {
            const format = dialog.querySelector('#formatSelect').value;
            const includeOriginalAudio = dialog.querySelector('#includeOriginalAudio').checked;
            const includeOverlayAudio = dialog.querySelector('#includeOverlayAudio').checked;
            const quality = dialog.querySelector('#qualitySelect').value;
            
            dialog.remove();
            
            try {
                utils.showStatus(`Экспорт видео в формате ${format.toUpperCase()}...`);
                
                // Call VideoEditor's exportMedia method
                const videoBlob = await state.videoEditor.exportMedia({
                    format,
                    includeOriginalAudio,
                    includeOverlayAudio,
                    quality
                });
                
                if (!videoBlob) {
                    throw new Error('Export failed - no video data');
                }
                
                const url = URL.createObjectURL(videoBlob);
                const link = document.createElement('a');
                link.href = url;
                
                // Определяем расширение файла
                const extension = format === 'mp4' ? 'mp4' : 'webm';
                link.download = `video-${Date.now()}.${extension}`;
                
                link.click();
                URL.revokeObjectURL(url);
                
                utils.showStatus(`Видео успешно экспортировано в ${format.toUpperCase()}`);
                resolvePromise(); // Use renamed resolve
            } catch (error) {
                utils.showError('Ошибка экспорта: ' + error.message);
                console.error(error);
                resolvePromise(); // Use renamed resolve
            }
        };

        dialog.querySelector('#startExportBtn').addEventListener('click', startExport);
        dialog.querySelector('#cancelExportBtn').addEventListener('click', () => {
            dialog.remove();
            resolvePromise(); // Use renamed resolve
        });

        document.body.appendChild(dialog);
    });
}