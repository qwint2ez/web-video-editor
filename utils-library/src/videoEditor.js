import { AudioOverlay } from './audioOverlay.js';
import { FilterApplier } from './filterApplier.js';
import { TextOverlay } from './textOverlay.js';
// import { VideoLoader } from './videoLoader.js'; // Удаляем импорт
import { VideoMerger } from './videoMerger.js';
import { VideoTrimmer } from './videoTrimmer.js';
import { VideoExporter } from './videoExporter.js';
import { TimelineUIManager } from '../../src/core/timelineUIManager.js';
import { ProjectSerializer } from './projectSerializer.js'; // Changed: Используем относительный путь
// MediaInfo is used internally by VideoMerger now

export class VideoEditor {
    constructor(dependencies) {
        if (!dependencies.videoElement || !dependencies.debugElement || !dependencies.timelineBar) {
            throw new Error('Required dependencies are missing for VideoEditor');
        }
        
        this.dependencies = dependencies;
        this.processors = {};
        this.projectSerializer = new ProjectSerializer(); // Added
        this._projectDefinitionForLoad = null; // Added: To store parsed project data during load
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
            // Можно добавить его в body как крайний случае, но лучше чтобы он был в контейнере видео
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
        
        let originalFileNameForTrim;
        let effectiveStartTime;
        let effectiveEndTime;

        if (videoFileToTrim._isTrimmedMarker && videoFileToTrim._originalFileName && videoFileToTrim._trimRange) {
            originalFileNameForTrim = videoFileToTrim._originalFileName;
            // startTime and endTime are relative to the current state of videoFileToTrim
            effectiveStartTime = videoFileToTrim._trimRange.start + startTime;
            effectiveEndTime = videoFileToTrim._trimRange.start + endTime; // Assuming endTime is relative to startTime of this trim op on the current blob
                                                                      // If endTime is absolute within videoFileToTrim, then it's videoFileToTrim._trimRange.start + endTime
                                                                      // Let's assume endTime is an offset from the start of the current blob segment.
                                                                      // No, standard interpretation: startTime and endTime are new start/end for *this current segment*.
                                                                      // So, if segment was 0-10 (from original 5-15), and we trim 2-8 (of this 0-10 segment),
                                                                      // it becomes original 5+2 to 5+8 = 7 to 13.
                                                                      // The parameters startTime, endTime are relative to the start of videoFileToTrim.
            // Corrected logic: startTime and endTime are new boundaries *within* the current videoFileToTrim.
            // The trimVideoSegmentLowLatency expects startTime and endTime relative to the blob it receives.
            // So, the effectiveStartTime and effectiveEndTime for metadata should be calculated based on previous _trimRange.start
             effectiveStartTime = (videoFileToTrim._trimRange?.start || 0) + startTime;
             effectiveEndTime = (videoFileToTrim._trimRange?.start || 0) + endTime;


        } else {
            originalFileNameForTrim = videoFileToTrim.name;
            effectiveStartTime = startTime;
            effectiveEndTime = endTime;
        }
        
        // Ensure endTime is not less than startTime for the operation itself
        if (endTime <= startTime) {
            throw new Error(`Trim end time (${endTime.toFixed(2)}s) must be after start time (${startTime.toFixed(2)}s) for the current segment.`);
        }


        const trimmedBlob = await this.processors.trimmer.trimVideoSegmentLowLatency(videoFileToTrim, startTime, endTime);
        
        if (trimmedBlob && trimmedBlob.size > 0) {
            // Attach metadata for serialization
            trimmedBlob._originalFileName = originalFileNameForTrim;
            trimmedBlob._trimRange = { start: effectiveStartTime, end: effectiveEndTime };
            trimmedBlob._isTrimmedMarker = true;
            // Generate a more descriptive name for the blob in the timeline
            trimmedBlob.name = `trimmed_${effectiveStartTime.toFixed(1)}-${effectiveEndTime.toFixed(1)}_${originalFileNameForTrim.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
            
            this.processors.merger.videos[videoIndex] = trimmedBlob;
            await this.processors.merger.loadMediaDurations(); 
            
            if (this.processors.merger.currentIndex === videoIndex) {
                await this.processors.merger.loadVideo(videoIndex);
            }
            
            this.processors.timelineUIManager.updateTimelineSegments();
            this.processors.timelineUIManager.updateTimeDisplay();
            this.dependencies.debugElement.textContent = `Status: Video ${videoIndex + 1} trimmed. Original: ${originalFileNameForTrim}`;
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

    // --- Project Serialization/Deserialization ---

    async saveProject(format = 'json') {
        if (!this.processors.merger) {
            throw new Error("Video merger not initialized. Cannot save project.");
        }

        const projectVideos = this.processors.merger.videos.map(video => {
            if (video._isTrimmedMarker && video._originalFileName && video._trimRange) {
                return {
                    originalFileName: video._originalFileName,
                    timelineDisplayName: video.name, // The name of the blob itself
                    isTrimmed: true,
                    trimStart: video._trimRange.start,
                    trimEnd: video._trimRange.end,
                };
            }
            return {
                originalFileName: video.name, // Assumes it's an original File object
                timelineDisplayName: video.name,
                isTrimmed: false,
            };
        });

        const projectAudio = this.processors.merger.audioFile ? {
            originalFileName: this.processors.merger.audioFile.name,
            timelineDisplayName: this.processors.merger.audioFile.name,
        } : null;

        const projectFilter = this.processors.filter.currentFilter ? {
            name: this.processors.filter.currentFilter,
        } : null;

        const projectText = this.processors.text.currentParams ? {
            ...this.processors.text.currentParams
        } : null;

        const projectState = {
            version: "1.0", // For future compatibility
            videos: projectVideos,
            audio: projectAudio,
            filter: projectFilter,
            text: projectText,
            // Note: Volume, current playback time are not saved. Focus is on edit decisions.
        };

        return this.projectSerializer.serialize(projectState, format);
    }

    async prepareLoadProject(projectFileContent, format = 'json') {
        try {
            const projectDefinition = this.projectSerializer.deserialize(projectFileContent, format);
            if (!projectDefinition) {
                throw new Error("Failed to parse project data.");
            }
            this._projectDefinitionForLoad = projectDefinition; // Store for finalizeLoadProject

            const requiredVideoFiles = projectDefinition.videos.map(v => v.originalFileName);
            const requiredAudioFiles = projectDefinition.audio ? [projectDefinition.audio.originalFileName] : [];
            
            // Deduplicate file names
            const allRequiredFiles = [...new Set([...requiredVideoFiles, ...requiredAudioFiles])];

            return {
                files: allRequiredFiles,
                // You could also return a summary of the project here if needed by the UI
            };
        } catch (error) {
            this._projectDefinitionForLoad = null;
            console.error("Error preparing project load:", error);
            throw error; // Re-throw for UI to handle
        }
    }

    async finalizeLoadProject(fileMap) {
        if (!this._projectDefinitionForLoad) {
            throw new Error("No project definition loaded. Call prepareLoadProject first.");
        }
        const projectDef = this._projectDefinitionForLoad;

        try {
            this.dependencies.debugElement.textContent = "Status: Loading project...";
            // 1. Clear current state (soft clear, merger will handle full clear)
            this.processors.filter.process({ filter: '' });
            if (this.processors.text.textElement) this.processors.text.textElement.innerHTML = '';
            this.processors.text.currentParams = null;
            // Merger will be cleared when new videos are loaded.

            // 2. Reconstruct video array
            const loadedVideos = [];
            for (const videoData of projectDef.videos) {
                const originalFile = fileMap[videoData.originalFileName];
                if (!originalFile) {
                    throw new Error(`Required original file "${videoData.originalFileName}" not provided.`);
                }

                if (videoData.isTrimmed && videoData.trimStart != null && videoData.trimEnd != null) {
                    // Trim the original file to the specified range
                    const trimmedBlob = await this.processors.trimmer.trimVideoSegmentLowLatency(
                        originalFile,
                        videoData.trimStart,
                        videoData.trimEnd
                    );
                    if (!trimmedBlob || trimmedBlob.size === 0) {
                        throw new Error(`Failed to re-trim file "${videoData.originalFileName}".`);
                    }
                    trimmedBlob._originalFileName = videoData.originalFileName;
                    trimmedBlob._trimRange = { start: videoData.trimStart, end: videoData.trimEnd };
                    trimmedBlob._isTrimmedMarker = true;
                    trimmedBlob.name = videoData.timelineDisplayName || `trimmed_${videoData.trimStart.toFixed(1)}-${videoData.trimEnd.toFixed(1)}_${videoData.originalFileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
                    loadedVideos.push(trimmedBlob);
                } else {
                    // Use the original file as is
                    // Ensure it has a 'name' property if it's a blob from a previous session that wasn't an original file
                    if (!originalFile.name && videoData.originalFileName) {
                        originalFile.name = videoData.originalFileName;
                    }
                    loadedVideos.push(originalFile);
                }
            }

            // 3. Reconstruct audio file
            let loadedAudioFile = null;
            if (projectDef.audio && projectDef.audio.originalFileName) {
                loadedAudioFile = fileMap[projectDef.audio.originalFileName];
                if (!loadedAudioFile) {
                    throw new Error(`Required original audio file "${projectDef.audio.originalFileName}" not provided.`);
                }
                 if (!loadedAudioFile.name && projectDef.audio.originalFileName) {
                        loadedAudioFile.name = projectDef.audio.originalFileName;
                    }
            }

            // 4. Load media into merger
            await this.processors.merger.process({
                videoFiles: loadedVideos,
                audioFile: loadedAudioFile,
            });
            // TimelineUIManager updates are called within merger.process

            // 5. Apply filter
            if (projectDef.filter && projectDef.filter.name) {
                this.processors.filter.process({ filter: projectDef.filter.name });
            }

            // 6. Apply text
            if (projectDef.text) {
                this.processors.text.process(projectDef.text);
            }

            this.dependencies.debugElement.textContent = "Status: Project loaded successfully.";
        } catch (error) {
            console.error("Error finalizing project load:", error);
            this.dependencies.debugElement.textContent = `Status: Error loading project - ${error.message}`;
            // Optionally, try to revert to a clean state or previous state if possible
        } finally {
            this._projectDefinitionForLoad = null; // Clear stored definition
        }
    }
}