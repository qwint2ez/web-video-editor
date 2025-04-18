export class VideoProcessor {
    constructor(videoElement, debugElement) {
        this.videoElement = videoElement;
        this.debugElement = debugElement;
    }

    process(...args) {
        throw new Error('Method "process" must be implemented by subclass');
    }
}