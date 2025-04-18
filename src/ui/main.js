import { VideoTrimmer } from '../core/videoTrimmer.js';
import { FilterApplier } from '../core/filterApplier.js';
import { TextOverlay } from '../core/textOverlay.js';
import { VideoMerger } from '../core/videoMerger.js';
import { AudioOverlay } from '../core/audioOverlay.js';
import { VideoLoader } from '../core/videoLoader.js';

const videoInput = document.getElementById('videoInput');
const audioInput = document.getElementById('audioInput');
const processedVideo = document.getElementById('processedVideo');
const debug = document.getElementById('debug');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const applyTrimBtn = document.getElementById('applyTrimBtn');
const textInput = document.getElementById('textInput');
const textPosition = document.getElementById('textPosition');
const textColor = document.getElementById('textColor');
const textSize = document.getElementById('textSize');
const applyTextBtn = document.getElementById('applyTextBtn');
const filterSelect = document.getElementById('filterSelect');
const applyFilterBtn = document.getElementById('applyFilterBtn');
const applyAudioBtn = document.getElementById('applyAudioBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteBtn = document.getElementById('muteBtn');
const volumeSlider = document.getElementById('volumeSlider');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const downloadBtn = document.getElementById('downloadBtn');
const timelineRange = document.getElementById('timelineRange');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');

let currentVideoFiles = [];

videoInput.addEventListener('change', (e) => {
  currentVideoFiles = Array.from(e.target.files);
  if (currentVideoFiles.length === 1) {
    processedVideo.src = URL.createObjectURL(currentVideoFiles[0]);
    processedVideo.onloadedmetadata = () => {
      timelineRange.max = processedVideo.duration;
      duration.textContent = formatTime(processedVideo.duration);
      debug.textContent = 'Status: Video loaded';
    };
  } else if (currentVideoFiles.length > 1) {
    videoMerger.mergeVideos(currentVideoFiles);
  }
});

const videoTrimmer = new VideoTrimmer(processedVideo, debug, timelineRange, currentTime, duration);
const filterApplier = new FilterApplier(processedVideo, debug);
const textOverlay = new TextOverlay(processedVideo, debug);
const videoMerger = new VideoMerger(processedVideo, debug, timelineRange, currentTime, duration);
const audioOverlay = new AudioOverlay(processedVideo, audioInput, debug);

applyTrimBtn.addEventListener('click', () => {
  const startTime = parseFloat(startInput.value);
  const endTime = parseFloat(endInput.value);
  try {
    videoTrimmer.applyTrim(startTime, endTime);
  } catch (error) {
    debug.textContent = `Status: Error! ${error.message}`;
  }
});

applyTextBtn.addEventListener('click', () => {
  const text = textInput.value;
  const position = textPosition.value;
  const color = textColor.value;
  const size = textSize.value;
  try {
    textOverlay.applyText(text, position, color, size);
  } catch (error) {
    debug.textContent = `Status: Error! ${error.message}`;
  }
});

applyFilterBtn.addEventListener('click', () => {
  const filter = filterSelect.value;
  try {
    filterApplier.applyFilter(filter);
  } catch (error) {
    debug.textContent = `Status: Error! ${error.message}`;
  }
});

applyAudioBtn.addEventListener('click', () => {
  try {
    audioOverlay.applyAudio();
  } catch (error) {
    debug.textContent = `Status: Error! ${error.message}`;
  }
});

playPauseBtn.addEventListener('click', () => {
  if (processedVideo.paused) {
    processedVideo.play();
    playPauseBtn.textContent = 'Pause';
  } else {
    processedVideo.pause();
    playPauseBtn.textContent = 'Play';
  }
});

muteBtn.addEventListener('click', () => {
  processedVideo.muted = !processedVideo.muted;
  muteBtn.textContent = processedVideo.muted ? 'Unmute' : 'Mute';
});

volumeSlider.addEventListener('input', () => {
  processedVideo.volume = volumeSlider.value;
});

fullscreenBtn.addEventListener('click', () => {
  if (processedVideo.requestFullscreen) {
    processedVideo.requestFullscreen();
  }
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = processedVideo.src;
  link.download = 'edited-video.mp4';
  link.click();
});

processedVideo.addEventListener('timeupdate', () => {
  const current = videoTrimmer.isTrimmed ? processedVideo.currentTime - videoTrimmer.startTime : videoMerger.getCurrentTime();
  timelineRange.value = current;
  currentTime.textContent = formatTime(current);
});

timelineRange.addEventListener('input', () => {
  const newTime = videoTrimmer.isTrimmed ? videoTrimmer.startTime + parseFloat(timelineRange.value) : videoMerger.seekTo(parseFloat(timelineRange.value));
  processedVideo.currentTime = newTime;
});

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}