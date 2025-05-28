import { VideoEditor } from '../core/videoEditor.js';

const dependencies = {
    videoElement: document.getElementById('processedVideo'),
    debugElement: document.getElementById('debug'),
    audioInput: document.getElementById('audioInput'),
    inputElement: document.getElementById('videoInput'),
    textElement: document.getElementById('textOverlay'),
    timelineRange: document.getElementById('timelineRange'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    endInput: document.getElementById('end'),
    startInput: document.getElementById('start'),
};

const videoEditor = new VideoEditor(dependencies);

// State for uploaded videos and timeline selection
const uploadedVideos = [];
let timelineVideos = [];

// UI elements for new features
const uploadedVideosSection = document.getElementById('uploadedVideosSection');
const uploadedVideosList = document.getElementById('uploadedVideosList');
const addToTimelineBtn = document.getElementById('addToTimelineBtn');
const timelineVisualization = document.getElementById('timelineVisualization');
const timelineBar = document.getElementById('timelineBar');

// Helper: Render uploaded videos list with checkboxes and drag handles
function renderUploadedVideosList() {
    uploadedVideosList.innerHTML = '';
    uploadedVideos.forEach((file, idx) => {
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
            li.classList.add('dragging');
            e.dataTransfer.setData('text/plain', idx);
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
                const moved = uploadedVideos.splice(fromIdx, 1)[0];
                uploadedVideos.splice(toIdx, 0, moved);
                renderUploadedVideosList();
            }
        });

        li.appendChild(checkbox);
        li.appendChild(label);
        uploadedVideosList.appendChild(li);
    });
}

// Helper: Render timeline visualization
function renderTimelineBar(videoDurations) {
    timelineBar.innerHTML = '';
    const colors = ['#74b9ff', '#55efc4', '#ffeaa7', '#fd79a8', '#fab1a0', '#a29bfe', '#fdcb6e'];
    const total = videoDurations.reduce((a, b) => a + b, 0);
    
    videoDurations.forEach((dur, idx) => {
        const seg = document.createElement('div');
        seg.className = 'timeline-segment';
        seg.style.width = `${(dur / total) * 100}%`;
        seg.style.background = colors[idx % colors.length];
        
        // Добавляем информацию о видео при наведении
        const videoInfo = uploadedVideos[idx];
        seg.title = `${videoInfo.name}\nДлительность: ${Math.round(dur)}с`;
        
        // Добавляем возможность удаления видео по двойному клику
        seg.addEventListener('dblclick', () => {
            if (confirm(`Удалить видео "${videoInfo.name}" из таймлайна?`)) {
                uploadedVideos[idx].selected = false;
                timelineVideos = timelineVideos.filter((_, i) => i !== idx);
                videoEditor.loadVideos(timelineVideos);
                renderTimelineBar(videoDurations.filter((_, i) => i !== idx));
            }
        });
        
        timelineBar.appendChild(seg);
    });
}

// Handle video uploads
document.getElementById('videoInput').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        uploadedVideos.push({ file, name: file.name, selected: false });
    });
    uploadedVideosSection.classList.remove('hidden');
    renderUploadedVideosList();
});

// Add selected videos to timeline (in order)
addToTimelineBtn.addEventListener('click', async () => {
    timelineVideos = uploadedVideos.filter(v => v.selected).map(v => v.file);
    if (timelineVideos.length === 0) {
        dependencies.debugElement.textContent = 'Статус: Выберите хотя бы одно видео';
        return;
    }

    dependencies.debugElement.textContent = 'Статус: Загрузка видео...';
    try {
        await videoEditor.loadVideos(timelineVideos);
        const durations = videoEditor.timeline.videos.map(v => v.duration);
        timelineVisualization.classList.remove('hidden');
        renderTimelineBar(durations);
        dependencies.debugElement.textContent = 'Статус: Видео загружены успешно';
    } catch (error) {
        dependencies.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

document.getElementById('applyTrimBtn').addEventListener('click', () => {
    const startTime = parseFloat(document.getElementById('start').value);
    const endTime = parseFloat(document.getElementById('end').value);
    try {
        videoEditor.applyTrim(startTime, endTime);
    } catch (error) {
        dependencies.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

document.getElementById('applyTextBtn').addEventListener('click', () => {
    const text = document.getElementById('textInput').value;
    const position = document.getElementById('textPosition').value;
    const color = document.getElementById('textColor').value;
    const size = document.getElementById('textSize').value;
    try {
        videoEditor.applyText(text, position, color, size);
    } catch (error) {
        dependencies.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const filter = document.getElementById('filterSelect').value;
    try {
        videoEditor.applyFilter(filter);
    } catch (error) {
        dependencies.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

document.getElementById('applyAudioBtn').addEventListener('click', () => {
    try {
        videoEditor.applyAudio();
    } catch (error) {
        dependencies.debugElement.textContent = `Статус: Ошибка! ${error.message}`;
    }
});

document.getElementById('playPauseBtn').addEventListener('click', () => {
    if (dependencies.videoElement.paused) {
        dependencies.videoElement.play();
        dependencies.playPauseBtn.textContent = 'Pause';
    } else {
        dependencies.videoElement.pause();
        dependencies.playPauseBtn.textContent = 'Play';
    }
});

document.getElementById('muteBtn').addEventListener('click', () => {
    dependencies.videoElement.muted = !dependencies.videoElement.muted;
    document.getElementById('muteBtn').textContent = dependencies.videoElement.muted ? 'Unmute' : 'Mute';
});

document.getElementById('volumeSlider').addEventListener('input', () => {
    dependencies.videoElement.volume = document.getElementById('volumeSlider').value;
});

document.getElementById('fullscreenBtn').addEventListener('click', () => {
    if (dependencies.videoElement.requestFullscreen) {
        dependencies.videoElement.requestFullscreen();
    }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = dependencies.videoElement.src;
    link.download = 'edited-video.mp4';
    link.click();
});

dependencies.videoElement.addEventListener('timeupdate', () => {
    const current = videoEditor.getCurrentTime();
    dependencies.timelineRange.value = current;
    dependencies.currentTime.textContent = videoEditor.formatTime(current);
});

dependencies.timelineRange.addEventListener('input', () => {
    videoEditor.seekTo(parseFloat(dependencies.timelineRange.value));
});