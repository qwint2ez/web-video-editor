import { VideoProcessor } from './videoProcessor.js';

export class VideoMerger extends VideoProcessor {
    constructor(videoElement, debugElement, timelineRange, currentTime, duration) {
        super(videoElement, debugElement);
        this.timelineRange = timelineRange;
        this.currentTime = currentTime;
        this.duration = duration;
        this.currentIndex = 0;
        this.videos = [];
        this.durations = [];
        this.totalDuration = 0;
        this.currentTimeOffset = 0;
    }

    async process(videoFiles) {
        if (videoFiles.length < 2) {
            this.debugElement.textContent = 'Status: Error! Select at least two videos';
            throw new Error('Select at least two videos');
        }
        this.videos = Array.from(videoFiles);
        this.currentIndex = 0;
        this.durations = [];
        this.totalDuration = 0;
        this.currentTimeOffset = 0;

        await this.loadDurations();
        this.playNext();
    }

    async loadDurations() {
        for (let i = 0; i < this.videos.length; i++) {
            const tempVideo = document.createElement('video');
            tempVideo.src = URL.createObjectURL(this.videos[i]);
            await new Promise((resolve) => {
                tempVideo.onloadedmetadata = () => {
                    this.durations[i] = tempVideo.duration;
                    this.totalDuration += tempVideo.duration;
                    resolve();
                };
            });
        }
    }

    playNext() {
        if (this.currentIndex < this.videos.length) {
            this.currentTimeOffset = this.durations.slice(0, this.currentIndex).reduce((a, b) => a + b, 0);
            this.videoElement.src = URL.createObjectURL(this.videos[this.currentIndex]);
            this.videoElement.play();
            this.timelineRange.max = this.totalDuration;
            this.duration.textContent = this.formatTime(this.totalDuration);
            this.currentIndex++;
            this.videoElement.addEventListener('ended', () => this.playNext(), { once: true });
            this.debugElement.textContent = 'Status: Videos merged';
        }
    }

    getCurrentTime() {
        return this.currentTimeOffset + this.videoElement.currentTime;
    }

    seekTo(time) {
        let accumulatedDuration = 0;
        for (let i = 0; i < this.durations.length; i++) {
            accumulatedDuration += this.durations[i];
            if (time <= accumulatedDuration) {
                this.currentIndex = i;
                this.currentTimeOffset = accumulatedDuration - this.durations[i];
                this.videoElement.src = URL.createObjectURL(this.videos[i]);
                this.videoElement.currentTime = time - this.currentTimeOffset;
                this.videoElement.play();
                break;
            }
        }
        return this.videoElement.currentTime;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
}