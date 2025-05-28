import { VideoProcessor } from './videoProcessor.js';

export class VideoTrimmer extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.merger = dependencies.merger;
        this.startTime = 0;
        this.endTime = 0;
        this.isTrimmed = false;
    }

    async process(params) {
        const { startTime, endTime } = params;
        const totalDuration = this.merger?.totalDuration || this.videoElement.duration;

        if (startTime < 0 || endTime > totalDuration || startTime >= endTime) {
            this.logError(`Время должно быть между 0 и ${totalDuration.toFixed(2)} секунд`);
            return;
        }

        try {
            await this.merger.trim(startTime, endTime);
            
            this.startTime = startTime;
            this.endTime = endTime;
            this.isTrimmed = true;
            
            this.debugElement.textContent = `Status: Видео обрезано ${startTime.toFixed(2)}с - ${endTime.toFixed(2)}с`;
        } catch (error) {
            this.logError(error.message);
        }
    }

    logError(message) {
        if (this.debugElement) {
            this.debugElement.textContent = `Status: Error! ${message}`;
        }
        console.error(message);
    }

    get isTrimmedState() {
        return this.isTrimmed;
    }

    get startTimeValue() {
        return this.startTime;
    }
}