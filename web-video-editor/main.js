import { VideoLoader } from './videoLoader.js';
import { VideoTrimmer } from './videoTrimmer.js';

const videoInput = document.getElementById('videoInput');
const sourceVideo = document.getElementById('video');
const trimmedVideo = document.getElementById('trimmedVideo');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const applyBtn = document.getElementById('applyBtn');
const debugElement = document.getElementById('debug');

const videoLoader = new VideoLoader(videoInput, sourceVideo, debugElement);
const videoTrimmer = new VideoTrimmer(sourceVideo, trimmedVideo, debugElement);

let trimHistory = [];

applyBtn.addEventListener('click', () => {
  const startTime = parseFloat(startInput.value);
  const endTime = parseFloat(endInput.value);

  try {
    videoTrimmer.applyTrim(startTime, endTime);
    const trimInfo = videoTrimmer.getTrimmedInfo();
    trimHistory.push(trimInfo);
    console.log('История обрезок:', trimHistory);
  } catch (error) {
    alert(error.message);
  }
});