import { AudioOverlay } from './audioOverlay.js';
import { FilterApplier } from './filterApplier.js';
import { TextOverlay } from './textOverlay.js';
import { VideoLoader } from './videoLoader.js';
import { VideoMerger } from './videoMerger.js';
import { VideoTrimmer } from './videoTrimmer.js';
import { TimelineManager } from './timelineManager.js';

export class VideoEditor {
    constructor(dependencies) {
        if (!dependencies.videoElement || !dependencies.debugElement) {
            throw new Error('Required dependencies are missing');
        }
        
        this.dependencies = dependencies;
        this.processors = {}; // Initialize processors object
        this.initializeDependencies();
    }

    initializeDependencies() {
        try {
            // Instantiate all processors first
            const loader = new VideoLoader(this.dependencies);
            const audio = new AudioOverlay(this.dependencies);
            const filter = new FilterApplier(this.dependencies);
            const text = new TextOverlay({
                ...this.dependencies,
                textElement: this.dependencies.textElement || this.createTextOverlay()
            });
            const merger = new VideoMerger(this.dependencies);
            const trimmer = new VideoTrimmer(this.dependencies);

            // Assign them to this.processors
            this.processors = {
                loader,
                audio,
                filter,
                text,
                merger,
                trimmer
            };

            // Now that all processors exist, pass the entire processors object
            // to any processor that might need to reference others.
            // For example, VideoMerger needs it for audio processing.
            if (this.processors.merger) {
                this.processors.merger.processors = this.processors;
            }
            // If other processors need it, set it here too:
            // if (this.processors.someOtherProcessor) {
            //     this.processors.someOtherProcessor.processors = this.processors;
            // }

            // Now, call setupTimelineElements for merger
            if (this.processors.merger && this.processors.merger.timelineBar) {
                this.processors.merger.setupTimelineElements();
            }

        } catch (error) {
            console.error('Initialization error details:', error);
            throw new Error(`Failed to initialize: ${error.message}`);
        }
    }

    createTextOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'textOverlay';
        overlay.style.position = 'absolute';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1';
        this.dependencies.videoElement.parentElement?.appendChild(overlay);
        return overlay;
    }

    async loadVideos(files, audioFile = null) {
        this.currentVideoFiles = Array.from(files || []);
        this.timeline = new TimelineManager();
        
        for (const file of this.currentVideoFiles) {
            this.timeline.addVideo(file);
        }
        
        await this.timeline.loadDurations();
        
        // Always use the merger for any video files, even a single video
        // This ensures consistent timeline behavior
        await this.processors.merger.process({ 
            videoFiles: this.currentVideoFiles,
            audioFile: audioFile 
        });

        // If audioFile exists but wasn't processed by merger, process it separately
        if (audioFile && !this.processors.merger.audioFile) {
            await this.processors.audio.process({ file: audioFile });
        }
    }

    applyAudio(audioFile) { // Added audioFile parameter based on main.js handleAudioUpload
        if (this.processors.audio) {
            this.processors.audio.process({ file: audioFile });
        } else {
            console.error("Audio processor is not available.");
        }
    }

    applyFilter(filter) {
        this.processors.filter.process({ filter });
    }

    applyText(text, position, color, size) {
        this.processors.text.process({ text, position, color, size });
    }

    applyTrim(startTime, endTime) {
        this.processors.trimmer.process({ startTime, endTime });
    }

    getCurrentTime() {
        // Ensure processors and merger are initialized before calling this
        if (this.processors && this.processors.merger && this.processors.trimmer) {
            return this.processors.trimmer.isTrimmedState
                ? this.processors.trimmer.videoElement.currentTime - this.processors.trimmer.startTimeValue
                : this.processors.merger.getCurrentTime();
        }
        return 0; // Default or error state
    }

    seekTo(time) {
        // Ensure processors and merger are initialized
        if (this.processors && this.processors.merger && this.processors.trimmer) {
            const newTime = this.processors.trimmer.isTrimmedState
                ? this.processors.trimmer.startTimeValue + time
                : this.processors.merger.seekTo(time); // seekTo in merger should return the time
            this.processors.trimmer.videoElement.currentTime = newTime;
        }
    }

    formatTime(seconds) {
        // Ensure timeline is initialized
        if (this.timeline) {
            return this.timeline.formatTime(seconds);
        }
        // Fallback formatting if timeline isn't ready (should ideally not happen in normal flow)
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}