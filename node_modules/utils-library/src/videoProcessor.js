export class VideoProcessor {
    constructor(dependencies) {
        this.videoElement = dependencies.videoElement;
        this.debugElement = dependencies.debugElement;
    }

    process(params) {
        console.warn('Default process method called');
        return Promise.resolve();
    }

    logError(message) {
        if (this.debugElement) {
            this.debugElement.textContent = `Status: Error! ${message}`;
        }
        console.error(message);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
}