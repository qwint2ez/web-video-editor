import { VideoProcessor } from './videoProcessor.js';

export class VideoTrimmer extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.timelineRange = dependencies.timelineRange;
        this.currentTime = dependencies.currentTime;
        this.duration = dependencies.duration;
        this.playPauseBtn = dependencies.playPauseBtn;
        this.startTime = 0;
        this.endTime = 0;
        this.isTrimmed = false;
    }

    process(params) {
        const { startTime, endTime } = params;
        if (endTime <= startTime) {
            this.logError('End time must be greater than start time');
        }
        if (startTime < 0 || endTime > this.videoElement.duration) {
            this.logError('Invalid time range');
        }

        this.startTime = startTime;
        this.endTime = endTime;
        this.isTrimmed = true;

        this.videoElement.currentTime = this.startTime;
        const trimmedDuration = endTime - startTime;
        this.timelineRange.max = trimmedDuration;
        this.duration.textContent = this.formatTime(trimmedDuration);

        this.videoElement.addEventListener('timeupdate', () => {
            if (this.isTrimmed) {
                if (this.videoElement.currentTime >= this.endTime) {
                    this.videoElement.pause();
                    this.videoElement.currentTime = this.startTime;
                    this.playPauseBtn.textContent = 'Play';
                }
                if (this.videoElement.currentTime < this.startTime) {
                    this.videoElement.currentTime = this.startTime;
                }
            }
        });

        this.debugElement.textContent = `Status: Video trimmed from ${this.startTime} to ${this.endTime} sec`;
    }

    get isTrimmedState() {
        return this.isTrimmed;
    }

    get startTimeValue() {
        return this.startTime;
    }
}