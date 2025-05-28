import { VideoProcessor } from './videoProcessor.js';

export class AudioOverlay extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.audio = null;
        this.audioFile = null;
        this.eventHandlers = {}; // To store and remove event listeners
    }

    async process(params) {
        const { file } = params;
        if (file) {
            this.audioFile = file;
            await this.applyAudio();
        } else {
            await this.clearAudio(); // Clear if no file is provided
        }
    }

    async applyAudio() {
        await this.clearAudio(); // Clear existing audio and listeners first

        if (!this.audioFile || !this.videoElement) {
            return;
        }

        try {
            const audioUrl = URL.createObjectURL(this.audioFile);
            this.audio = new Audio(audioUrl);
            this.audio.loop = true;

            // Store handlers to remove them later
            this.eventHandlers.play = () => {
                if (this.audio && this.videoElement) {
                    this.audio.currentTime = this.videoElement.currentTime;
                    this.audio.play().catch(e => console.warn("Audio play interrupted:", e));
                }
            };
            this.eventHandlers.pause = () => {
                if (this.audio) this.audio.pause();
            };
            this.eventHandlers.seeking = () => {
                if (this.audio && this.videoElement) {
                    this.audio.currentTime = this.videoElement.currentTime;
                }
            };
            this.eventHandlers.volumechange = () => {
                if (this.audio && this.videoElement) {
                    this.audio.volume = this.videoElement.volume;
                }
            };

            this.videoElement.addEventListener('play', this.eventHandlers.play);
            this.videoElement.addEventListener('pause', this.eventHandlers.pause);
            this.videoElement.addEventListener('seeking', this.eventHandlers.seeking);
            this.videoElement.addEventListener('volumechange', this.eventHandlers.volumechange);

            if (this.videoElement) {
                this.audio.volume = this.videoElement.volume;
            }
            this.debugElement.textContent = 'Status: Audio overlay applied';
        } catch (error) {
            this.logError('Failed to apply audio overlay');
            console.error(error);
        }
    }

    async clearAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null; // Release the Audio object
        }
        // Remove event listeners
        if (this.videoElement) {
            if (this.eventHandlers.play) this.videoElement.removeEventListener('play', this.eventHandlers.play);
            if (this.eventHandlers.pause) this.videoElement.removeEventListener('pause', this.eventHandlers.pause);
            if (this.eventHandlers.seeking) this.videoElement.removeEventListener('seeking', this.eventHandlers.seeking);
            if (this.eventHandlers.volumechange) this.videoElement.removeEventListener('volumechange', this.eventHandlers.volumechange);
        }
        this.eventHandlers = {}; // Clear stored handlers
        this.audioFile = null; // Clear the stored audio file
        // this.debugElement.textContent = 'Status: Audio cleared'; // Optional status update
    }
}