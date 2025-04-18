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

document.getElementById('videoInput').addEventListener('change', (e) => {
    videoEditor.loadVideos(e.target.files);
});

document.getElementById('applyTrimBtn').addEventListener('click', () => {
    const startTime = parseFloat(document.getElementById('start').value);
    const endTime = parseFloat(document.getElementById('end').value);
    try {
        videoEditor.applyTrim(startTime, endTime);
    } catch (error) {
        dependencies.debugElement.textContent = `Status: Error! ${error.message}`;
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
        dependencies.debugElement.textContent = `Status: Error! ${error.message}`;
    }
});

document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const filter = document.getElementById('filterSelect').value;
    try {
        videoEditor.applyFilter(filter);
    } catch (error) {
        dependencies.debugElement.textContent = `Status: Error! ${error.message}`;
    }
});

document.getElementById('applyAudioBtn').addEventListener('click', () => {
    try {
        videoEditor.applyAudio();
    } catch (error) {
        dependencies.debugElement.textContent = `Status: Error! ${error.message}`;
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