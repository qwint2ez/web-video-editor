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

        if (!this.merger) {
            this.logError("VideoMerger is not available for trimming.");
            return;
        }

        const totalDuration = this.merger.totalDuration;

        if (this.merger.videos.length === 0) {
            this.logError("Нет видео для обрезки.");
            return;
        }

        if (startTime < 0 || endTime > totalDuration || startTime >= endTime) {
            this.logError(`Время для общей обрезки должно быть между 0 и ${totalDuration.toFixed(2)} секунд`);
            return;
        }

        try {
            // Показываем статус обрезки
            this.debugElement.textContent = `Status: Global trimming in progress... (${(endTime - startTime).toFixed(1)}s)`;
            
            await this.merger.trim(startTime, endTime);

            this.debugElement.textContent = `Status: Global trim completed ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`;
        } catch (error) {
            this.logError('Ошибка при общей обрезке: ' + error.message);
            console.error(error);
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