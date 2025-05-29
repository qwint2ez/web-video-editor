import { AudioOverlay } from './audioOverlay.js';
import { FilterApplier } from './filterApplier.js';
import { TextOverlay } from './textOverlay.js';
// import { VideoLoader } from './videoLoader.js'; // Удаляем импорт
import { VideoMerger } from './videoMerger.js';
import { VideoTrimmer } from './videoTrimmer.js';
import { VideoExporter } from './videoExporter.js';
import { TimelineUIManager } from './timelineUIManager.js';
// MediaInfo is used internally by VideoMerger now

export class VideoEditor {
    constructor(dependencies) {
        if (!dependencies.videoElement || !dependencies.debugElement || !dependencies.timelineBar) {
            throw new Error('Required dependencies are missing for VideoEditor');
        }
        
        this.dependencies = dependencies;
        this.processors = {};
        this.initializeDependencies();
    }

    initializeDependencies() {
        try {
            const textOverlayElement = this.dependencies.textElement || this.createTextOverlay();

            const timelineUIManager = new TimelineUIManager(
                this.dependencies.timelineBar,
                null, 
                this.dependencies.videoElement
            );

            this.processors = {
                // loader: new VideoLoader(this.dependencies), // Удаляем инициализацию VideoLoader
                audio: new AudioOverlay(this.dependencies),
                filter: new FilterApplier(this.dependencies), 
                text: new TextOverlay({ ...this.dependencies, textElement: textOverlayElement }),
                merger: new VideoMerger({ ...this.dependencies, timelineUIManager }),
                trimmer: new VideoTrimmer(this.dependencies),
                exporter: new VideoExporter({ processors: this.processors, debugElement: this.dependencies.debugElement }),
                timelineUIManager: timelineUIManager,
            };
            
            // Now that merger is instantiated, if timelineUIManager needs a direct reference:
            timelineUIManager.merger = this.processors.merger;


            // Pass the full 'processors' object to components that need access to others
            // For example, VideoMerger might need access to 'audio' processor for its internal logic.
            // And VideoExporter needs access to 'filter' and 'text' processors.
            this.processors.merger.processors = this.processors; // For audio processing within merger
            this.processors.exporter.processors = this.processors; // For filter/text application during export

            // Initial setup for timeline UI
            this.processors.timelineUIManager.setupTimelineElements();


        } catch (error) {
            console.error('Initialization error details:', error);
            throw new Error(`Failed to initialize VideoEditor: ${error.message}`);
        }
    }

    createTextOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'textOverlay';
        overlay.style.position = 'absolute'; // Добавим стили, если их не было
        overlay.style.pointerEvents = 'none'; // Чтобы не перехватывал клики
        overlay.style.zIndex = '1'; // Чтобы был поверх видео, но под контролами если нужно
        // Убедимся, что videoElement.parentElement существует
        const parent = this.dependencies.videoElement.parentElement;
        if (parent) {
            parent.appendChild(overlay);
        } else {
            console.warn('Video element parent not found for text overlay, text overlay might not be visible.');
            // Можно добавить его в body как крайний случай, но лучше чтобы он был в контейнере видео
            document.body.appendChild(overlay); 
        }
        return overlay;
    }

    async loadVideos(files, audioFile = null) {
        const videoFiles = Array.from(files || []);
        // VideoMerger's process method now handles loading durations internally using MediaInfo
        await this.processors.merger.process({ 
            videoFiles: videoFiles,
            audioFile: audioFile 
        });
        // TimelineUIManager's updateTimelineSegments and updateTimeDisplay are called within merger.process
    }

    applyAudio(audioFile) {
        // This might now be primarily handled by loadVideos passing the audioFile to merger.
        // If separate application is needed:
        if (this.processors.merger) {
            // Reloading with the new audio file
            this.processors.merger.process({ 
                videoFiles: this.processors.merger.videos, // Keep current videos
                audioFile: audioFile 
            });
        } else {
            console.error("Merger processor is not available for applying audio.");
        }
    }

    applyFilter(filter) {
        this.processors.filter.process({ filter });
    }

    applyText(text, position, color, size) {
        this.processors.text.process({ text, position, color, size });
    }

    async trimSingleVideo(videoIndex, startTime, endTime) {
        if (!this.processors.merger || !this.processors.trimmer) {
            throw new Error("Merger or Trimmer not initialized.");
        }
        if (videoIndex < 0 || videoIndex >= this.processors.merger.videos.length) {
            throw new Error("Invalid video index for trimming.");
        }

        const videoFileToTrim = this.processors.merger.videos[videoIndex];
        // const originalDuration = this.processors.merger.durations[videoIndex]; // Use this for validation if needed

        // Use the advanced trimVideoSegmentLowLatency for better results with audio
        const trimmedBlob = await this.processors.trimmer.trimVideoSegmentLowLatency(videoFileToTrim, startTime, endTime);
        
        if (trimmedBlob && trimmedBlob.size > 0) {
            this.processors.merger.videos[videoIndex] = trimmedBlob;
            // The duration of the trimmedBlob should ideally be known or re-calculated.
            // For now, _knownDuration is set by trimVideoSegmentLowLatency.
            // Then, reload media durations in merger.
            await this.processors.merger.loadMediaDurations(); // This will update durations and totalDuration
            
            // If current video was trimmed, reload it. Otherwise, just update UI.
            if (this.processors.merger.currentIndex === videoIndex) {
                await this.processors.merger.loadVideo(videoIndex);
            }
            
            this.processors.timelineUIManager.updateTimelineSegments();
            this.processors.timelineUIManager.updateTimeDisplay();
            this.dependencies.debugElement.textContent = `Status: Video ${videoIndex + 1} trimmed.`;
        } else {
            this.dependencies.debugElement.textContent = `Status: Trimming video ${videoIndex + 1} resulted in empty file.`;
        }
    }
    
    async exportMedia(exportOptions) {
        if (!this.processors.exporter || !this.processors.merger) {
            this.dependencies.debugElement.textContent = "Exporter or Merger not initialized.";
            return null;
        }
        return await this.processors.exporter.exportVideo(
            this.processors.merger.videos,
            this.processors.merger.durations,
            this.processors.merger.audioFile,
            this.processors.merger.audioDuration,
            exportOptions
        );
    }

    getCurrentTime() {
        return this.processors.merger ? this.processors.merger.getCurrentTime() : 0;
    }

    seekTo(time) {
       if (this.processors.merger) this.processors.merger.seekTo(time);
    }

    formatTime(seconds) {
        return this.processors.merger ? this.processors.merger.formatTime(seconds) : "00:00";
    }
}