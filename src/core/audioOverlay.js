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
        await this.clearAudio(); 

        if (!this.audioFile || !this.videoElement) {
            return;
        }

        try {
            const audioUrl = URL.createObjectURL(this.audioFile);
            this.audio = new Audio(audioUrl);
            this.audio.loop = true;

            this.eventHandlers.play = () => {
                if (this.audio && this.videoElement) {
                    this.audio.currentTime = this.videoElement.currentTime;
                    this.audio.play().catch(error => {
                        if (error.name !== 'AbortError') {
                            console.warn("Audio play failed:", error.name, error.message);
                        }
                    });
                }
            };
            this.eventHandlers.pause = () => {
                if (this.audio) this.audio.pause();
            };
            this.eventHandlers.seeking = () => {
                if (this.audio && this.videoElement) {
                    // Ensure currentTime is not set to NaN or undefined
                    const videoTime = parseFloat(this.videoElement.currentTime);
                    if (Number.isFinite(videoTime)) {
                        this.audio.currentTime = videoTime;
                    }
                }
            };
            this.eventHandlers.volumechange = () => {
                if (this.audio && this.videoElement) {
                    this.audio.volume = this.videoElement.volume;
                }
            };
            // Handle ended event for the main video to potentially stop or loop audio if needed,
            // though current logic is to loop audio indefinitely.
            // this.eventHandlers.ended = () => { if (this.audio) this.audio.pause(); /* or loop logic */ };


            this.videoElement.addEventListener('play', this.eventHandlers.play);
            this.videoElement.addEventListener('pause', this.eventHandlers.pause);
            this.videoElement.addEventListener('seeking', this.eventHandlers.seeking);
            this.videoElement.addEventListener('volumechange', this.eventHandlers.volumechange);
            // this.videoElement.addEventListener('ended', this.eventHandlers.ended);


            if (this.videoElement) {
                this.audio.volume = this.videoElement.volume;
                if (!this.videoElement.paused) {
                    const videoTime = parseFloat(this.videoElement.currentTime);
                    if (Number.isFinite(videoTime)) {
                        this.audio.currentTime = videoTime;
                    }
                    this.audio.play().catch(error => {
                        if (error.name !== 'AbortError') {
                            console.warn("Audio play failed on applyAudio:", error.name, error.message);
                        }
                    });
                }
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
            // It's good practice to remove the src to release resources,
            // though setting to null and removing listeners is key.
            if (this.audio.src && this.audio.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audio.src);
            }
            this.audio.removeAttribute('src'); // More thorough cleanup
            this.audio.load(); // Aborts current playback and resets
            this.audio = null; 
        }
        if (this.videoElement) {
            if (this.eventHandlers.play) this.videoElement.removeEventListener('play', this.eventHandlers.play);
            if (this.eventHandlers.pause) this.videoElement.removeEventListener('pause', this.eventHandlers.pause);
            if (this.eventHandlers.seeking) this.videoElement.removeEventListener('seeking', this.eventHandlers.seeking);
            if (this.eventHandlers.volumechange) this.videoElement.removeEventListener('volumechange', this.eventHandlers.volumechange);
            // if (this.eventHandlers.ended) this.videoElement.removeEventListener('ended', this.eventHandlers.ended);
        }
        this.eventHandlers = {}; 
        // this.audioFile = null; // audioFile is managed by VideoMerger, AudioOverlay just uses it.
                               // Clearing it here might cause issues if VideoMerger expects it to persist.
                               // Let VideoMerger manage the lifecycle of audioFile.
        // this.debugElement.textContent = 'Status: Audio cleared'; 
    }
}