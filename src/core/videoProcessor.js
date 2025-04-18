export class VideoProcessor {
    constructor(dependencies) {
        this.videoElement = dependencies.videoElement;
        this.debugElement = dependencies.debugElement;
    }

    process(params) {
        throw new Error('Method "process" must be implemented by subclass');
    }

    logError(message) {
        this.debugElement.textContent = `Status: Error! ${message}`;
        throw new Error(message);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
}