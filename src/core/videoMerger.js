import { VideoProcessor } from './videoProcessor.js';

export class VideoMerger extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies); // Ensure VideoProcessor constructor is called
        this.videos = [];
        this.durations = []; 
        this.totalDuration = 0; 
        this.currentIndex = 0;
        this.currentTimeOffset = 0; 
        this.isPlaying = false;
        this.audioFile = null;
        this.audioDuration = 0; 
        // this.processors will be set by VideoEditor after all processors are instantiated
        // Avoid using this.processors directly in the constructor for cross-processor dependencies
        
        this.timelineContainer = dependencies.timelineContainer;
        this.timelineBar = document.getElementById('timelineBar');
        
        // Bind event handler methods to this instance
        this.handleTimelineBarClick = this.handleTimelineBarClick.bind(this);
        this.handleVideoTimeUpdate = this.handleVideoTimeUpdate.bind(this);
        this.handleVideoEnded = this.handleVideoEnded.bind(this);

        this.bindEvents();
        // if (this.timelineBar) { // Removed call from here
        //     this.setupTimelineElements();
        // }
    }

    formatTime(seconds) {
        let numericSeconds = parseFloat(seconds); // Ensure it's a number
        if (!Number.isFinite(numericSeconds) || numericSeconds < 0) {
            numericSeconds = 0;
        }
        const minutes = Math.floor(numericSeconds / 60);
        const secs = Math.floor(numericSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }


    async getVideoDuration(file) {
        return new Promise((resolve) => {
            if (!file || !(file instanceof Blob || file instanceof File)) {
                console.error("Invalid file provided to getVideoDuration:", file);
                resolve(0); 
                return;
            }
            const video = document.createElement('video');
            video.preload = 'metadata';
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(file);
                video.src = srcUrl;
            } catch (error) {
                console.error(`Error creating object URL for file ${file.name || 'unknown file'} in getVideoDuration:`, error);
                if (srcUrl) URL.revokeObjectURL(srcUrl);
                resolve(0);
                return;
            }
            video.onloadedmetadata = () => {
                const duration = video.duration;
                URL.revokeObjectURL(srcUrl);
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            video.onerror = (e) => {
                URL.revokeObjectURL(srcUrl);
                console.error(`Error loading video metadata for duration: ${file.name || 'unknown file'}`, e);
                resolve(0); 
            };
        });
    }

    setupTimelineElements() {
        if (!this.timelineBar) return;

        this.timelineBar.removeEventListener('click', this.handleTimelineBarClick);
        this.timelineBar.addEventListener('click', this.handleTimelineBarClick);

        this.cursor = this.timelineBar.querySelector('.timeline-cursor');
        if (!this.cursor) {
            this.cursor = document.createElement('div');
            this.cursor.className = 'timeline-cursor';
            this.timelineBar.appendChild(this.cursor);
        }

        this.progress = this.timelineBar.querySelector('.timeline-progress');
        if (!this.progress) {
            this.progress = document.createElement('div');
            this.progress.className = 'timeline-progress';
            this.timelineBar.appendChild(this.progress);
        }
        this.updateTimeDisplay(); 
    }

    async handleTimelineBarClick(e) {
        if (e.target.classList.contains('delete-btn') || !Number.isFinite(this.totalDuration) || this.totalDuration <= 0) return;
        const rect = this.timelineBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = this.totalDuration * pos;
        await this.seekTo(time); 
    }

    getCurrentTime() {
        if (this.videoElement && Number.isFinite(this.videoElement.currentTime) && Number.isFinite(this.currentTimeOffset)) {
            return this.currentTimeOffset + this.videoElement.currentTime;
        }
        return this.currentTimeOffset; // Or just 0 if videoElement is not ready
    }

    async seekTo(time) {
        if (!Number.isFinite(time) || time < 0 || (this.totalDuration > 0 && time > this.totalDuration) || this.videos.length === 0) {
            console.warn(`SeekTo: Invalid time ${time} or no videos.`);
            return;
        }

        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            const segmentDuration = (this.durations[i] && Number.isFinite(this.durations[i])) ? this.durations[i] : 0;
            const nextTimeBoundary = accumulatedTime + segmentDuration;
            
            if (time <= nextTimeBoundary || i === this.videos.length - 1) { // Also handle if it's the last segment
                this.currentIndex = i;
                this.currentTimeOffset = accumulatedTime;
                await this.loadVideo(i); // loadVideo should handle pausing/playing
                
                const seekInCurrentVideo = Math.max(0, time - accumulatedTime);
                if (this.videoElement && Number.isFinite(seekInCurrentVideo)) {
                    this.videoElement.currentTime = seekInCurrentVideo;
                }
                
                // If playing, ensure it continues. loadVideo might pause.
                if (this.isPlaying && this.videoElement && this.videoElement.paused) {
                    this.videoElement.play().catch(e => console.warn("SeekTo: Play interrupted", e));
                }
                this.updateTimeDisplay();
                break;
            }
            accumulatedTime = nextTimeBoundary;
        }
    }


    handleVideoTimeUpdate() {
        this.updateTimeDisplay(); 
    }

    handleVideoEnded() {
        this.playNext(); 
    }


    bindEvents() {
        if (this.videoElement) {
            this.videoElement.removeEventListener('timeupdate', this.handleVideoTimeUpdate);
            this.videoElement.removeEventListener('ended', this.handleVideoEnded);

            this.videoElement.addEventListener('timeupdate', this.handleVideoTimeUpdate);
            this.videoElement.addEventListener('ended', this.handleVideoEnded);
        }
    }

    async process(params) {
        const { videoFiles, audioFile } = params;
        
        if (this.videoElement) {
            this.videoElement.pause();
        }
        this.isPlaying = false;
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) playPauseBtn.textContent = 'Play';

        // Always create a new array to avoid reference issues
        this.videos = [];
        if (videoFiles && videoFiles.length > 0) {
            // Convert FileList to Array and filter out any non-blob items
            this.videos = Array.from(videoFiles).filter(file => 
                file instanceof Blob || file instanceof File
            );
        }
        
        if (audioFile === null) {
            this.audioFile = null;
        } else if (audioFile !== undefined) {
            this.audioFile = audioFile;
        }
        
        this.currentIndex = 0;
        this.currentTimeOffset = 0;

        // Make sure this method exists and is properly defined
        await this.loadMediaDurations();

        // Try to load the first video if any videos are available
        if (this.videos.length > 0) {
            this.currentTimeOffset = 0; 
            await this.loadVideo(0);
            
            // Process audio if needed
            if (this.processors && this.processors.audio) {
                if (this.audioFile) {
                    await this.processors.audio.process({ file: this.audioFile });
                } else { 
                    await this.processors.audio.clearAudio();
                }
            }
            
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = 'Статус: Media loaded successfully';
        } else {
            if (this.videoElement) this.videoElement.src = '';
            this.currentTimeOffset = 0;
            
            if (this.processors?.audio) {
                await this.processors.audio.clearAudio();
            }
            
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = 'Статус: Timeline cleared';
        }
    }

    async loadMediaDurations() {
        let videoTotalDurationNum = 0;
        this.durations = []; 

        if (this.videos && this.videos.length > 0) {
            for (const videoFile of this.videos) {
                // Ensure videoFile is a valid File/Blob before getting duration
                if (videoFile instanceof Blob || videoFile instanceof File) {
                    const duration = await this.getVideoDuration(videoFile);
                    this.durations.push(duration); 
                    videoTotalDurationNum += duration;
                } else {
                    this.durations.push(0); // Push 0 for invalid entries
                    console.warn("Invalid video item in videos array:", videoFile);
                }
            }
        }

        let audioDurationNum = 0;
        if (this.audioFile) {
            audioDurationNum = await this.getAudioFileDuration(this.audioFile); 
        }
        this.audioDuration = audioDurationNum; 
        
        this.totalDuration = Math.max(videoTotalDurationNum, audioDurationNum);
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) {
            this.totalDuration = 0; 
        }
    }
    
    async getAudioFileDuration(file) {
        return new Promise((resolve) => {
            if (!file || !(file instanceof Blob || file instanceof File)) {
                console.error("Invalid file provided to getAudioFileDuration:", file);
                resolve(0);
                return;
            }
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(file);
                audio.src = srcUrl;
            } catch (error) {
                console.error(`Error creating object URL for audio file ${file.name || 'unknown file'}:`, error);
                if (srcUrl) URL.revokeObjectURL(srcUrl);
                resolve(0);
                return;
            }
            audio.onloadedmetadata = () => {
                const duration = audio.duration;
                URL.revokeObjectURL(srcUrl); 
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            audio.onerror = () => {
                console.error("Error loading audio duration for file:", file.name || 'unknown file');
                URL.revokeObjectURL(srcUrl);
                resolve(0); 
            }
        });
    }

    updateTimelineSegments() {
        if (!this.timelineBar) {
            console.error("Timeline bar not found for segment update");
            return;
        }

        this.timelineBar.innerHTML = '';
        let currentVideoOffset = 0;
        let timelineBarActualHeight = 0;

        // CRITICAL: Force a minimum effective duration to prevent div-by-zero issues
        // and ensure videos are displayed even if totalDuration is 0
        const effectiveTotalDuration = Math.max(0.001, this.totalDuration);

        // Render videos if there are any, even with zero duration
        if (this.videos && this.videos.length > 0) {
            timelineBarActualHeight = 40;
            
            // Loop through all videos, even those with 0 duration
            this.videos.forEach((video, index) => {
                const segment = document.createElement('div');
                segment.className = 'timeline-segment video-segment';
                
                const segmentDuration = (Number.isFinite(this.durations[index]) && this.durations[index] >= 0) 
                    ? this.durations[index] 
                    : 0;
                
                // Calculate width and position as percentage of total duration
                const widthPercent = (segmentDuration / effectiveTotalDuration) * 100;
                const leftPercent = (currentVideoOffset / effectiveTotalDuration) * 100;
                
                segment.style.width = `${Math.max(0, Math.min(100, widthPercent))}%`;
                segment.style.left = `${Math.max(0, Math.min(100, leftPercent))}%`;
                
                const label = document.createElement('div');
                label.className = 'video-info';
                const startNum = Number.isFinite(currentVideoOffset) ? currentVideoOffset : 0;
                const endNum = startNum + segmentDuration;
                
                // Always show the segment, even if it has 0 duration
                label.textContent = `Video ${index + 1} (${startNum.toFixed(2)}-${endNum.toFixed(2)}s)`;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeVideo(index);
                };
                
                segment.appendChild(label);
                segment.appendChild(deleteBtn);
                this.timelineBar.appendChild(segment);
                
                currentVideoOffset += segmentDuration;
            });
        }

        if (this.audioFile) {
            const audioTrackHeight = 20;
            const gap = (this.videos && this.videos.length > 0) ? 10 : 0; 
            const audioTopPos = (this.videos && this.videos.length > 0) ? timelineBarActualHeight + gap : 0;
            
            timelineBarActualHeight = audioTopPos + audioTrackHeight; 

            const audioSegment = document.createElement('div');
            audioSegment.className = 'timeline-segment audio-segment';
            
            const finiteAudioDuration = (Number.isFinite(this.audioDuration) && this.audioDuration >= 0) ? this.audioDuration : 0;
            let audioWidthPercent = 0;

            if (this.totalDuration > 0) {
                audioWidthPercent = (finiteAudioDuration / this.totalDuration) * 100;
            } else if ((!this.videos || this.videos.length === 0) && finiteAudioDuration > 0) { 
                // Only audio exists, and it has duration, but totalDuration might be 0 if videos were 0.
                // In this specific case, audio should take full width.
                audioWidthPercent = 100;
            }
            // If totalDuration is 0 and audioDuration is 0, audioWidthPercent remains 0.


            audioSegment.style.width = `${Math.max(0, Math.min(100, audioWidthPercent))}%`; 
            audioSegment.style.left = '0%';
            audioSegment.style.top = `${audioTopPos}px`; 
            audioSegment.style.height = `${audioTrackHeight}px`;

            const audioLabel = document.createElement('div');
            audioLabel.className = 'video-info'; 
            const audioName = this.audioFile.name || 'Audio File';
            audioLabel.textContent = `Audio: ${audioName.substring(0, 30)}${audioName.length > 30 ? '...' : ''}`;
            audioLabel.style.bottom = '2px';

            const deleteAudioBtn = document.createElement('button');
            deleteAudioBtn.className = 'delete-btn';
            deleteAudioBtn.textContent = '×';
            deleteAudioBtn.style.top = '2px'; 
            deleteAudioBtn.style.right = '2px';
            deleteAudioBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeAudio();
            };

            audioSegment.appendChild(audioLabel);
            audioSegment.appendChild(deleteAudioBtn);
            this.timelineBar.appendChild(audioSegment);
        }
        
        // Ensure timelineBar has a minimum height
        const minHeight = (this.videos && this.videos.length > 0) || this.audioFile ? 40 : 0;
        this.timelineBar.style.height = `${Math.max(minHeight, timelineBarActualHeight)}px`;
        
        // Re-add cursor and progress elements as innerHTML clears them
        this.setupTimelineElements();
    }

    async loadVideo(index) {
        if (this.videoElement && this.videos && index >= 0 && index < this.videos.length) {
            this.videoElement.pause(); 
            
            // Calculate currentTimeOffset based on durations of videos before the current one
            this.currentTimeOffset = 0;
            for (let i = 0; i < index; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) {
                    this.currentTimeOffset += this.durations[i];
                }
            }

            const videoUrl = URL.createObjectURL(this.videos[index]);
            this.videoElement.src = videoUrl;
            this.currentIndex = index;
            
            return new Promise((resolve, reject) => {
                this.videoElement.onloadedmetadata = () => {
                    if (this.isPlaying) {
                        this.videoElement.play().catch(e => console.warn("Play interrupted on load:", e.name, e.message));
                    }
                    resolve();
                };
                this.videoElement.onerror = (e) => {
                    console.error("Error loading video:", e);
                    URL.revokeObjectURL(videoUrl); // Clean up if error
                    reject(e);
                }
            });
        } else if (this.videoElement && (!this.videos || this.videos.length === 0)) {
            this.videoElement.src = ''; 
            this.updateTimeDisplay();
            return Promise.resolve();
        }
        return Promise.resolve(); 
    }

    async playNext() {
        if (!this.videos || this.videos.length === 0) return;

        if (this.currentIndex >= this.videos.length - 1) { 
            this.currentIndex = 0;
            this.currentTimeOffset = 0;
            await this.loadVideo(0);
            if (this.isPlaying) { 
                this.videoElement.pause();
                this.isPlaying = false; 
                const playPauseBtn = document.getElementById('playPauseBtn');
                if (playPauseBtn) playPauseBtn.textContent = 'Play';
            }
            return;
        }

        this.currentTimeOffset += Number.isFinite(this.durations[this.currentIndex]) ? this.durations[this.currentIndex] : 0;
        this.currentIndex++;
        
        try {
            await this.loadVideo(this.currentIndex);
        } catch (error) {
            console.error('Error in playNext:', error);
        }
    }
    
    async togglePlay() {
        try {
            if (!this.videoElement || ((!this.videoElement.src || this.videoElement.src === window.location.href) && (!this.videos || this.videos.length === 0))) {
                this.isPlaying = false;
                const playPauseBtn = document.getElementById('playPauseBtn');
                if (playPauseBtn) playPauseBtn.textContent = 'Play';
                return;
            }

            if (this.videoElement.paused) {
                if (this.videos.length > 0 && this.currentIndex >= this.videos.length) { // Ensure current index is valid
                    this.currentIndex = 0;
                    this.currentTimeOffset = 0;
                    await this.loadVideo(0); 
                }
                this.isPlaying = true;
                document.getElementById('playPauseBtn').textContent = 'Pause';
                if (this.videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
                     await this.videoElement.play().catch(e => console.warn("Play interrupted on toggle:", e.name, e.message));
                } else {
                    this.videoElement.oncanplay = async () => {
                         await this.videoElement.play().catch(e => console.warn("Play interrupted on canplay:", e.name, e.message));
                         this.videoElement.oncanplay = null; 
                    };
                }
            } else {
                this.isPlaying = false;
                document.getElementById('playPauseBtn').textContent = 'Play';
                this.videoElement.pause();
            }
        } catch (error) {
            console.error('Toggle play error:', error);
            this.debugElement.textContent = 'Status: Error playing video';
        }
    }

    async trimVideoSegment(videoFile, start, end) {
        return new Promise((resolve, reject) => {
            if (start >= end) {
                resolve(new Blob([], { type: 'video/webm' })); 
                return;
            }

            const video = document.createElement('video');
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(videoFile);
                video.src = srcUrl;
            } catch (error) {
                console.error("Error creating object URL for trimVideoSegment:", error);
                if(srcUrl) URL.revokeObjectURL(srcUrl);
                reject(error);
                return;
            }
            video.muted = true;
            let recorder; 
            let canvas;
            let frameRequestCallbackId;

            const cleanup = () => {
                if (frameRequestCallbackId) cancelAnimationFrame(frameRequestCallbackId);
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                video.remove(); 
            };

            video.onloadedmetadata = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    video.onloadeddata = () => { 
                        if (video.videoWidth === 0 || video.videoHeight === 0) {
                            cleanup();
                            reject(new Error("Failed to get video dimensions for trimming after loadeddata."));
                            return;
                        }
                        video.currentTime = start;
                    };
                } else {
                    video.currentTime = start;
                }
            };
    
            video.onseeked = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Video dimensions are zero at onseeked. Cannot trim."));
                    return;
                }

                canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                
                const stream = canvas.captureStream(30); 
                
                try {
                    recorder = new MediaRecorder(stream, {
                        mimeType: 'video/webm;codecs=vp8', 
                        videoBitsPerSecond: 2500000 
                    });
                } catch (e) {
                    cleanup();
                    reject(new Error(`MediaRecorder initialization failed: ${e.message}`));
                    return;
                }
    
                const chunks = [];
                recorder.ondataavailable = e => {
                    if (e.data.size > 0) chunks.push(e.data);
                };
    
                recorder.onstop = () => {
                    cleanup();
                    resolve(new Blob(chunks, { type: 'video/webm' }));
                };
                recorder.onerror = (event) => {
                    cleanup();
                    reject(event.error || new Error("MediaRecorder failed during trim."));
                };
    
                const drawLoop = () => {
                    if (video.currentTime >= end || video.ended) {
                        if (recorder && recorder.state === "recording") recorder.stop();
                        return; 
                    }
                    
                    if (recorder && recorder.state === "recording" && !video.paused) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frameRequestCallbackId = requestAnimationFrame(drawLoop);
                    } else if (recorder && recorder.state === "recording" && video.paused) {
                        recorder.stop(); 
                    }
                };
    
                video.play()
                    .then(() => {
                        if (recorder.state === "inactive") recorder.start(); 
                        frameRequestCallbackId = requestAnimationFrame(drawLoop);
                    })
                    .catch(err => {
                        cleanup();
                        if (recorder && recorder.state === "recording") recorder.stop();
                        reject(err);
                    });
            };
    
            video.onerror = (e) => {
                cleanup();
                const errorMsg = e.target?.error ? `Code: ${e.target.error.code}, Message: ${e.target.error.message}` : "Unknown video error";
                if (recorder && recorder.state === "recording") recorder.stop();
                reject(new Error(`Video element failed to load for trimming: ${errorMsg}`));
            };
        });
    }
    
    async trim(startTime, endTime) { 
        if (!this.videos || this.videos.length === 0) {
            this.logError("Нет видео для обрезки.");
            return;
        }
        // Validate overall trim times against the current totalDuration
        const currentTotalDuration = (Number.isFinite(this.totalDuration) && this.totalDuration > 0) ? this.totalDuration : 0;
        
        // Allow trimming to 0 length if startTime and endTime are the same
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime < startTime || (currentTotalDuration > 0 && endTime > currentTotalDuration) ) {
            this.logError(`Некорректный общий интервал для обрезки: ${startTime}-${endTime}. Общая длительность: ${currentTotalDuration}`);
            return;
        }

        try {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';
            
            let newVideos = [];
            let accumulatedTimeBeforeSegment = 0; 

            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                // this.durations should be up-to-date from a previous loadMediaDurations call
                const originalSegmentDuration = (this.durations[i] && Number.isFinite(this.durations[i])) ? this.durations[i] : 0;
                const segmentEndBoundaryInTimeline = accumulatedTimeBeforeSegment + originalSegmentDuration;
                
                const effectiveTrimStart = Math.max(startTime, accumulatedTimeBeforeSegment);
                const effectiveTrimEnd = Math.min(endTime, segmentEndBoundaryInTimeline);
                
                if (effectiveTrimEnd > effectiveTrimStart) { 
                    const trimStartInSegment = effectiveTrimStart - accumulatedTimeBeforeSegment;
                    const trimEndInSegment = effectiveTrimEnd - accumulatedTimeBeforeSegment;
                    
                    if (trimEndInSegment > trimStartInSegment) {
                        const trimmedSegmentBlob = await this.trimVideoSegment(videoFile, trimStartInSegment, trimEndInSegment);
                        if (trimmedSegmentBlob.size > 0) {
                            newVideos.push(trimmedSegmentBlob);
                        }
                    }
                }
                accumulatedTimeBeforeSegment += originalSegmentDuration; // Use original duration for offset calculation
            }

            this.videos = newVideos;
            
            await this.loadMediaDurations(); // Recalculate all durations based on new video blobs
            
            this.currentIndex = 0;
            this.currentTimeOffset = 0;
            
            if (this.videos.length > 0) {
                await this.loadVideo(0);
            } else {
                if (this.videoElement) this.videoElement.src = ''; 
            }
            
            if (this.audioFile && this.processors?.audio) {
                await this.processors.audio.applyAudio(); 
            }

            this.updateTimelineSegments(); // Render timeline with new durations
            this.updateTimeDisplay();
            this.debugElement.textContent = `Статус: Обрезка выполнена с ${startTime.toFixed(2)}с до ${endTime.toFixed(2)}с`;

        } catch (error) {
            console.error('Error trimming video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }
    
    async trimSingleVideo(index, startTime, endTime) {
        if (!this.videos || this.videos.length === 0) {
            this.logError('Нет видео для обрезки.');
            return;
        }
        
        if (index < 0 || index >= this.videos.length) {
            this.logError('Неверный индекс видео для обрезки.');
            return;
        }

        const videoFileToTrim = this.videos[index];
        if (!videoFileToTrim) {
            this.logError(`Видео с индексом ${index} не найдено.`);
            return;
        }

        const originalSegmentDuration = (Number.isFinite(this.durations[index]) && this.durations[index] >= 0) 
            ? this.durations[index] 
            : 0;

        const safeStartTime = (Number.isFinite(startTime) && startTime >= 0) ? startTime : 0;
        const safeEndTime = (Number.isFinite(endTime) && endTime > safeStartTime) ? endTime : originalSegmentDuration;

        if (safeStartTime < 0 || safeEndTime > originalSegmentDuration) {
            this.logError(`Время для обрезки видео ${index + 1} некорректно. Start: ${safeStartTime.toFixed(2)}, End: ${safeEndTime.toFixed(2)}, Original Duration: ${originalSegmentDuration.toFixed(2)}`);
            return;
        }

        try {
            this.videoElement.pause();
            this.isPlaying = false;
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (playPauseBtn) playPauseBtn.textContent = 'Play';

            // Trim the video segment
            const trimmedVideoBlob = await this.trimVideoSegment(videoFileToTrim, safeStartTime, safeEndTime);
            
            // Critical: Replace the video at the same index - don't remove it!
            // This preserves the video order in the timeline
            this.videos[index] = trimmedVideoBlob;
            
            // Recalculate durations for all videos
            await this.loadMediaDurations();
            
            // Recalculate currentTimeOffset based on durations of videos before currentIndex
            this.currentTimeOffset = 0;
            for (let i = 0; i < this.currentIndex; i++) {
                this.currentTimeOffset += (Number.isFinite(this.durations[i]) ? this.durations[i] : 0);
            }
            
            // Reload current video
            if (this.videos.length > 0) {
                this.currentIndex = Math.min(this.currentIndex, this.videos.length - 1);
                await this.loadVideo(this.currentIndex);
            } else {
                if (this.videoElement) this.videoElement.src = '';
            }
            
            // Update audio if present
            if (this.audioFile && this.processors?.audio) {
                await this.processors.audio.applyAudio();
            }
            
            // Update the timeline visualization and time display
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = `Статус: Видео ${index + 1} успешно обрезано`;
        } catch (error) {
            console.error('Error trimming single video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }

    async removeVideo(index) { 
        if (index >= 0 && index < this.videos.length) {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';

            const removedVideo = this.videos.splice(index, 1)[0];
            if (removedVideo) { // Revoke object URL if it's a Blob
                // Check if it's a blob and has a URL created by createObjectURL
                // This is a bit tricky as we don't store the URL itself.
                // For now, we assume it's a blob that might have an active URL.
                // A more robust way would be to manage URLs explicitly.
            }
            
            await this.loadMediaDurations(); // Recalculate all durations

            // Adjust currentIndex and currentTimeOffset
            if (this.currentIndex >= this.videos.length && this.videos.length > 0) {
                this.currentIndex = this.videos.length - 1;
            } else if (this.videos.length === 0) {
                this.currentIndex = 0;
            }
            
            this.currentTimeOffset = 0;
            for(let i=0; i < this.currentIndex; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) this.currentTimeOffset += this.durations[i];
            }

            this.updateTimelineSegments(); // Render timeline with new durations

            if (this.videos.length > 0) {
                await this.loadVideo(this.currentIndex);
            } else {
                if (this.videoElement) this.videoElement.src = '';
                this.currentTimeOffset = 0; // Ensure offset is 0 if no videos
            }
            this.updateTimeDisplay();
            this.debugElement.textContent = 'Статус: Видео удалено';
        }
    }

    async removeAudio() { 
        if (this.processors?.audio) {
            await this.processors.audio.clearAudio();
        }
        this.audioFile = null;
        // this.audioDuration = 0; // loadMediaDurations will handle this
        
        await this.loadMediaDurations(); // Recalculate totalDuration
        this.updateTimelineSegments(); // Render timeline
        this.updateTimeDisplay();
        this.debugElement.textContent = 'Статус: Audio removed';
    }

    // Centralized method to update time display for both current and total duration
    updateTimeDisplay() {
        const currentTime = this.getCurrentTime();
        const validCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
        const validTotalDuration = Number.isFinite(this.totalDuration) ? this.totalDuration : 0;

        const percentage = (validTotalDuration > 0) ? (validCurrentTime / validTotalDuration) * 100 : 0;
        const safePercentage = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));

        if (this.cursor) {
            this.cursor.style.left = `${safePercentage}%`;
        }
        if (this.progress) {
            this.progress.style.width = `${safePercentage}%`;
        }

        const currentTimeDisplay = document.getElementById('currentTime');
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = this.formatTime(validCurrentTime);
        }
        const totalDurationDisplay = document.getElementById('duration');
        if (totalDurationDisplay) {
            totalDurationDisplay.textContent = this.formatTime(validTotalDuration);
        }
    }
}