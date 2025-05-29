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
            
            // Если это blob размером 0, сразу возвращаем 0
            if (file.size === 0) {
                console.warn("File has 0 size, returning 0 duration");
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
            
            // Увеличим таймаут для обрезанных видео
            const timeout = setTimeout(() => {
                console.warn("Video duration loading timeout");
                URL.revokeObjectURL(srcUrl);
                resolve(0);
            }, 10000); // 10 секунд таймаут
            
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                const duration = video.duration;
                URL.revokeObjectURL(srcUrl);
                console.log(`Duration loaded: ${duration} for file size: ${file.size}`);
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            
            video.onerror = (e) => {
                clearTimeout(timeout);
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
            console.log('Loading durations for videos:', this.videos.length);
            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                if (videoFile instanceof Blob || videoFile instanceof File) {
                    const duration = await this.getVideoDuration(videoFile);
                    console.log(`Video ${i+1} duration:`, duration);
                    this.durations.push(duration); 
                    videoTotalDurationNum += duration;
                } else {
                    console.warn("Invalid video item at index", i, videoFile);
                    this.durations.push(0);
                }
            }
        }

        let audioDurationNum = 0;
        if (this.audioFile) {
            audioDurationNum = await this.getAudioFileDuration(this.audioFile); 
        }
        this.audioDuration = audioDurationNum; 
        
        // Ensure totalDuration is never 0 if we have videos
        this.totalDuration = Math.max(videoTotalDurationNum, audioDurationNum);
        if (this.videos.length > 0 && this.totalDuration === 0) {
            // If we have videos but total duration is 0, set a minimum
            this.totalDuration = 0.1; // 0.1 second minimum for display purposes
        }
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) {
            this.totalDuration = 0; 
        }
        
        console.log('Total duration calculated:', this.totalDuration);
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

        console.log('Rendering timeline for videos:', this.videos.length, 'with durations:', this.durations, 'total duration:', this.totalDuration);

        this.timelineBar.innerHTML = '';
        let currentVideoOffset = 0;
        let timelineBarActualHeight = 40; // Высота для видео трека

        // Рендерим видео треки
        if (this.videos && this.videos.length > 0) {
            this.videos.forEach((video, index) => {
                const segment = document.createElement('div');
                segment.className = 'timeline-segment video-segment';
                
                const segmentDuration = (Number.isFinite(this.durations[index]) && this.durations[index] >= 0) 
                    ? this.durations[index] 
                    : 0;
                
                let widthPercent = 0;
                let leftPercent = 0;
                
                // Рассчитываем ширину сегмента
                if (this.totalDuration > 0) {
                    widthPercent = (segmentDuration / this.totalDuration) * 100;
                    leftPercent = (currentVideoOffset / this.totalDuration) * 100;
                } else {
                    // Если общая длительность 0, распределяем равномерно
                    widthPercent = 100 / this.videos.length;
                    leftPercent = (index * 100) / this.videos.length;
                }
                
                // Минимальная ширина для видимости
                if (widthPercent < 2) {
                    widthPercent = 2;
                }
                
                segment.style.width = `${Math.max(0, Math.min(100, widthPercent))}%`;
                segment.style.left = `${Math.max(0, Math.min(100, leftPercent))}%`;
                segment.style.top = '0px';
                segment.style.height = '40px';
                
                // Визуальный индикатор для видео с нулевой длительностью
                if (segmentDuration === 0) {
                    segment.style.background = 'repeating-linear-gradient(45deg, #e74c3c, #e74c3c 10px, #c0392b 10px, #c0392b 20px)';
                    segment.style.opacity = '0.7';
                } else {
                    segment.style.background = '#3498db';
                }
                
                const label = document.createElement('div');
                label.className = 'video-info';
                const startNum = Number.isFinite(currentVideoOffset) ? currentVideoOffset : 0;
                const endNum = startNum + segmentDuration;
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
        
        // Рендерим аудио трек отдельно снизу
        if (this.audioFile) {
            const audioTrackHeight = 25;
            const gap = 5; 
            const audioTopPos = timelineBarActualHeight + gap;
            
            timelineBarActualHeight = audioTopPos + audioTrackHeight;
            
            const audioSegment = document.createElement('div');
            audioSegment.className = 'timeline-segment audio-segment';
            
            const finiteAudioDuration = (Number.isFinite(this.audioDuration) && this.audioDuration >= 0) ? this.audioDuration : 0;
            
            // Аудио всегда занимает всю ширину таймлайна, но показывает свою реальную длительность
            audioSegment.style.width = '100%'; 
            audioSegment.style.left = '0%';
            audioSegment.style.top = `${audioTopPos}px`; 
            audioSegment.style.height = `${audioTrackHeight}px`;
            audioSegment.style.background = 'linear-gradient(90deg, #fd79a8, #fdcb6e)';
            audioSegment.style.border = '1px solid #e17055';
            
            const audioLabel = document.createElement('div');
            audioLabel.className = 'audio-info';
            audioLabel.style.color = 'white';
            audioLabel.style.fontSize = '12px';
            audioLabel.style.padding = '2px 8px';
            const audioName = this.audioFile.name || 'Audio File';
            const displayDuration = finiteAudioDuration > 0 ? `${finiteAudioDuration.toFixed(1)}s` : '0s';
            audioLabel.textContent = `♪ ${audioName.substring(0, 20)}${audioName.length > 20 ? '...' : ''} (${displayDuration})`;
            
            const deleteAudioBtn = document.createElement('button');
            deleteAudioBtn.className = 'delete-btn audio-delete';
            deleteAudioBtn.textContent = '×';
            deleteAudioBtn.style.top = '2px'; 
            deleteAudioBtn.style.right = '2px';
            deleteAudioBtn.style.background = '#e17055';
            deleteAudioBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeAudio();
            };
            
            audioSegment.appendChild(audioLabel);
            audioSegment.appendChild(deleteAudioBtn);
            this.timelineBar.appendChild(audioSegment);
        }
        
        // Устанавливаем высоту таймлайна
        const minHeight = (this.videos && this.videos.length > 0) || this.audioFile ? 
            (this.audioFile ? timelineBarActualHeight : 40) : 0;
        this.timelineBar.style.height = `${Math.max(minHeight, timelineBarActualHeight)}px`;
        
        // Добавляем курсор и прогресс
        this.setupTimelineElements();
    }

    async loadVideo(index) {
        if (this.videoElement && this.videos && index >= 0 && index < this.videos.length) {
            this.videoElement.pause(); 
            
            // Calculate currentTimeOffset
            this.currentTimeOffset = 0;
            for (let i = 0; i < index; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) {
                    this.currentTimeOffset += this.durations[i];
                }
            }

            const videoBlob = this.videos[index];
            if (!videoBlob || !(videoBlob instanceof Blob || videoBlob instanceof File)) {
                console.error("Invalid video blob at index", index);
                this.debugElement.textContent = 'Ошибка: Неверный формат видео';
                return Promise.reject(new Error("Invalid video blob"));
            }

            if (videoBlob.size === 0) {
                console.warn("Video blob has 0 size at index", index);
                this.debugElement.textContent = 'Предупреждение: Видео имеет нулевой размер';
                this.updateTimeDisplay();
                return Promise.resolve();
            }

            const videoUrl = URL.createObjectURL(videoBlob);
            this.videoElement.src = videoUrl;
            this.currentIndex = index;
            
            // Оптимизация: устанавливаем preload для лучшей производительности
            this.videoElement.preload = 'metadata';
            
            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    URL.revokeObjectURL(videoUrl);
                };
                
                this.videoElement.onloadedmetadata = () => {
                    console.log("Video loaded successfully at index", index);
                    if (this.isPlaying) {
                        this.videoElement.play().catch(e => console.warn("Play interrupted on load:", e.name, e.message));
                    }
                    resolve();
                };
                
                this.videoElement.onerror = (e) => {
                    console.error("Error loading video at index", index, ":", e);
                    cleanup();
                    this.debugElement.textContent = `Ошибка загрузки видео ${index + 1}`;
                    resolve();
                };
                
                // Уменьшенный таймаут
                setTimeout(() => {
                    if (this.videoElement.readyState < 2) {
                        console.warn("Video loading timeout at index", index);
                        cleanup();
                        resolve();
                    }
                }, 3000); // Уменьшен с 5000 до 3000
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
            let isRecording = false;
            
            const cleanup = () => {
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                if (recorder && recorder.state !== 'inactive') {
                    recorder.stop();
                }
                video.remove(); 
            };

            video.onloadedmetadata = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Invalid video dimensions"));
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
                        videoBitsPerSecond: 1000000
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
                    isRecording = false;
                    if (chunks.length > 0) {
                        resolve(new Blob(chunks, { type: 'video/webm' }));
                    } else {
                        reject(new Error("No data recorded"));
                    }
                };
                
                recorder.onerror = (event) => {
                    cleanup();
                    isRecording = false;
                    reject(event.error || new Error("Recording failed"));
                };

                // Сначала позиционируемся, потом запускаем запись
                video.currentTime = start;
                
                video.onseeked = () => {
                    if (!isRecording && recorder.state === 'inactive') {
                        isRecording = true;
                        recorder.start(100);
                        
                        const targetDuration = (end - start) * 1000; // в миллисекундах
                        const startTime = Date.now();
                        
                        const renderFrame = () => {
                            const elapsed = Date.now() - startTime;
                            const currentPos = video.currentTime;
                            
                            if (elapsed >= targetDuration || currentPos >= end || video.ended || !isRecording) {
                                if (isRecording && recorder.state === "recording") {
                                    recorder.stop();
                                }
                                return;
                            }
                            
                            // Рисуем текущий кадр
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            // Переходим к следующему кадру
                            const progress = elapsed / targetDuration;
                            const nextTime = start + (end - start) * progress;
                            video.currentTime = Math.min(nextTime, end);
                            
                            // Продолжаем рендеринг
                            setTimeout(renderFrame, 33); // ~30 FPS
                        };
                        
                        renderFrame();
                    }
                };
            };

            video.onerror = (e) => {
                cleanup();
                reject(new Error(`Video loading failed: ${e.message || 'Unknown error'}`));
            };
        });
    }
    
    async trim(startTime, endTime) { 
        if (!this.videos || this.videos.length === 0) {
            this.logError("Нет видео для обрезки.");
            return;
        }
        
        // Validate trim times
        const currentTotalDuration = (Number.isFinite(this.totalDuration) && this.totalDuration > 0) ? this.totalDuration : 0;
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime < startTime || 
            (currentTotalDuration > 0 && endTime > currentTotalDuration)) {
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
        const originalSegmentDuration = (Number.isFinite(this.durations[index]) && this.durations[index] >= 0) 
            ? this.durations[index] 
            : 0;

        const safeStartTime = (Number.isFinite(startTime) && startTime >= 0) ? startTime : 0;
        const safeEndTime = (Number.isFinite(endTime) && endTime >= safeStartTime) ? endTime : originalSegmentDuration;

        if (safeStartTime < 0 || safeEndTime > originalSegmentDuration) {
            this.logError(`Время для обрезки видео ${index + 1} некорректно. Start: ${safeStartTime.toFixed(2)}, End: ${safeEndTime.toFixed(2)}, Original Duration: ${originalSegmentDuration.toFixed(2)}`);
            return;
        }

        const expectedTrimmedDuration = safeEndTime - safeStartTime;
        console.log(`Trimming video ${index} from ${safeStartTime}s to ${safeEndTime}s, expected duration: ${expectedTrimmedDuration}s`);

        try {
            this.debugElement.textContent = `Status: Video trimming in progress... (${(safeEndTime - safeStartTime).toFixed(1)}s segment)`;
            
            this.videoElement.pause();
            this.isPlaying = false;
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (playPauseBtn) playPauseBtn.textContent = 'Play';

            // Используем оптимизированную обрезку для лучшей производительности
            const trimmedVideoBlob = await this.trimVideoSegmentLowLatency(videoFileToTrim, safeStartTime, safeEndTime);
            console.log('Trimmed video blob size:', trimmedVideoBlob.size);
            
            if (trimmedVideoBlob.size === 0) {
                console.warn('Trimmed video has 0 size');
                this.logError('Обрезанное видео имеет нулевой размер');
                return;
            }
            
            this.videos[index] = trimmedVideoBlob;
            this.durations[index] = expectedTrimmedDuration;
            console.log(`Manually set duration for video ${index} to ${expectedTrimmedDuration}s`);
            
            // Пересчитываем общую длительность
            let videoTotalDuration = 0;
            for (let i = 0; i < this.durations.length; i++) {
                if (Number.isFinite(this.durations[i])) {
                    videoTotalDuration += this.durations[i];
                }
            }
            
            this.totalDuration = Math.max(videoTotalDuration, this.audioDuration || 0);
            console.log('Updated total duration:', this.totalDuration);
            
            // Пересчитываем смещение по времени
            this.currentTimeOffset = 0;
            for (let i = 0; i < this.currentIndex; i++) {
                this.currentTimeOffset += (Number.isFinite(this.durations[i]) ? this.durations[i] : 0);
            }
            
            // Загружаем видео без перезагрузки всех сегментов
            if (this.videos.length > 0) {
                await this.loadVideo(this.currentIndex);
            }
            
            // Обновляем аудио если есть
            if (this.audioFile && this.processors?.audio) {
                await this.processors.audio.applyAudio();
            }
            
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = `Status: Video ${index + 1} trimmed successfully (${expectedTrimmedDuration.toFixed(2)}s)`;
            
        } catch (error) {
            console.error('Error trimming single video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }

    // Оптимизированная версия обрезки с низкой задержкой
    async trimVideoSegmentLowLatency(videoFile, start, end) {
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
            video.preload = 'auto';
            let recorder; 
            let canvas;
            let isRecording = false;
            
            const cleanup = () => {
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                if (recorder && recorder.state !== 'inactive') {
                    recorder.stop();
                }
                video.remove(); 
            };

            video.onloadedmetadata = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Invalid video dimensions"));
                    return;
                }
                
                canvas = document.createElement('canvas');
                // Оптимизация: устанавливаем willReadFrequently для лучшей производительности
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                // Уменьшаем разрешение для лучшей производительности
                const scaleFactor = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
                canvas.width = Math.floor(video.videoWidth * scaleFactor);
                canvas.height = Math.floor(video.videoHeight * scaleFactor);
                
                const stream = canvas.captureStream(20);
                
                try {
                    recorder = new MediaRecorder(stream, {
                        mimeType: 'video/webm;codecs=vp8', 
                        videoBitsPerSecond: 300000
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
                    isRecording = false;
                    if (chunks.length > 0) {
                        resolve(new Blob(chunks, { type: 'video/webm' }));
                    } else {
                        reject(new Error("No data recorded"));
                    }
                };
                
                recorder.onerror = (event) => {
                    cleanup();
                    isRecording = false;
                    reject(event.error || new Error("Recording failed"));
                };

                video.currentTime = start;
                
                video.onseeked = () => {
                    if (!isRecording && recorder.state === 'inactive') {
                        isRecording = true;
                        recorder.start(500); // Увеличиваем интервал для стабильности
                        
                        const targetDuration = (end - start) * 1000;
                        const startTime = Date.now();
                        const targetFPS = 12; // Еще более низкий FPS для плавности
                        
                        const renderFrame = () => {
                            const elapsed = Date.now() - startTime;
                            
                            if (elapsed >= targetDuration || video.ended || !isRecording) {
                                if (isRecording && recorder.state === "recording") {
                                    recorder.stop();
                                }
                                return;
                            }
                            
                            // Рисуем кадр с масштабированием
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            // Управляем позицией видео
                            const progress = elapsed / targetDuration;
                            const nextTime = start + (end - start) * progress;
                            video.currentTime = Math.min(nextTime, end);
                            
                            setTimeout(renderFrame, 1000 / targetFPS);
                        };
                        
                        renderFrame();
                    }
                };
            };

            video.onerror = (e) => {
                cleanup();
                reject(new Error(`Video loading failed: ${e.message || 'Unknown error'}`));
            };
        });
    }

    async exportVideo(exportOptions = {}) {
        if ((!this.videos || this.videos.length === 0) && !this.audioFile) {
            this.logError("No media to export.");
            return null;
        }

        const { 
            includeOriginalAudio = true, 
            includeOverlayAudio = true,
            format = 'webm',
            quality = 'medium'
        } = exportOptions;

        this.debugElement.textContent = "Status: Preparing export...";
        
        try {
            // Простой случай - одно видео без дополнительной обработки
            if (this.videos.length === 1 && !this.audioFile && includeOriginalAudio && 
                !this.processors?.text?.textElement?.textContent && 
                !this.processors?.filter?.currentFilter) {
                this.debugElement.textContent = "Status: Export finished.";
                return this.videos[0];
            }
            
            // Сложный экспорт с обработкой
            return await this.exportWithProcessing(exportOptions);
            
        } catch (error) {
            console.error('Export error:', error);
            this.logError('Ошибка при экспорте видео: ' + error.message);
            this.debugElement.textContent = "Status: Export failed. " + error.message;
            return null; 
        }
    }

    async exportWithProcessing(exportOptions) {
        const { 
            includeOriginalAudio = true, 
            includeOverlayAudio = true,
            quality = 'medium',
            format = 'webm' // Добавляем поддержку формата
        } = exportOptions;
        
        this.debugElement.textContent = "Status: Creating export stream...";
        
        let canvas, ctx, audioContext, mixedAudioDestination;
        let videoStreamTracks = [];
        let audioStreamTracks = [];
        let objectUrlsToRevoke = [];

        try {
            // Настройка видео потока
            if (this.videos && this.videos.length > 0) {
                canvas = document.createElement('canvas');
                // Оптимизация: устанавливаем willReadFrequently
                ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                // Получаем размеры из первого видео
                const firstVideoFile = this.videos[0];
                const firstVideoSrc = URL.createObjectURL(firstVideoFile);
                objectUrlsToRevoke.push(firstVideoSrc);
                
                const tempVideo = document.createElement('video');
                tempVideo.src = firstVideoSrc;
                
                await new Promise((resolve, reject) => {
                    tempVideo.onloadedmetadata = () => {
                        canvas.width = tempVideo.videoWidth || 640;
                        canvas.height = tempVideo.videoHeight || 480;
                        resolve();
                    };
                    tempVideo.onerror = reject;
                    setTimeout(reject, 5000);
                });
                
                const canvasStream = canvas.captureStream(30);
                videoStreamTracks = canvasStream.getVideoTracks();
            }

            // Улучшенная настройка аудио микшера
            if (includeOriginalAudio || (includeOverlayAudio && this.audioFile)) {
                audioContext = new AudioContext();
                mixedAudioDestination = audioContext.createMediaStreamDestination();
                
                const mainGain = audioContext.createGain();
                mainGain.connect(mixedAudioDestination);
                
                if (includeOriginalAudio && this.videos.length > 0) {
                    await this.setupOriginalAudioForExportImproved(mainGain, audioContext, objectUrlsToRevoke);
                }
                
                if (includeOverlayAudio && this.audioFile) {
                    await this.addOverlayAudioToMixImproved(mainGain, audioContext, objectUrlsToRevoke);
                }
                
                audioStreamTracks = mixedAudioDestination.stream.getAudioTracks();
            }

            const combinedStreamTracks = [...videoStreamTracks, ...audioStreamTracks];
            if (combinedStreamTracks.length === 0) {
                throw new Error("No tracks to record for export.");
            }
            
            const combinedStream = new MediaStream(combinedStreamTracks);
            
            // Улучшенные настройки качества с поддержкой разных форматов
            const formatSettings = {
                webm: {
                    mimeType: 'video/webm;codecs=vp8,opus',
                    low: { video: 800000, audio: 96000 },
                    medium: { video: 1500000, audio: 128000 },
                    high: { video: 3000000, audio: 192000 }
                },
                mp4: {
                    mimeType: 'video/mp4;codecs=h264,aac',
                    low: { video: 1000000, audio: 128000 },
                    medium: { video: 2000000, audio: 128000 },
                    high: { video: 4000000, audio: 192000 }
                }
            };
            
            const formatConfig = formatSettings[format] || formatSettings.webm;
            const settings = formatConfig[quality] || formatConfig.medium;
            
            let recorder;
            try {
                recorder = new MediaRecorder(combinedStream, {
                    mimeType: formatConfig.mimeType,
                    videoBitsPerSecond: settings.video,
                    audioBitsPerSecond: settings.audio,
                });
            } catch (e) {
                // Fallback to WebM if the requested format is not supported
                console.warn(`Format ${format} not supported, falling back to WebM`);
                recorder = new MediaRecorder(combinedStream, {
                    mimeType: 'video/webm;codecs=vp8,opus',
                    videoBitsPerSecond: settings.video,
                    audioBitsPerSecond: settings.audio,
                });
            }
            
            const chunks = [];
            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            
            return new Promise(async (resolve, reject) => {
                recorder.onstop = () => {
                    objectUrlsToRevoke.forEach(url => URL.revokeObjectURL(url));
                    if (audioContext) audioContext.close().catch(e => console.warn("Error closing audio context:", e));
                    
                    if (chunks.length > 0) {
                        // Правильно устанавливаем MIME type для экспортированного файла
                        const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
                        const blob = new Blob(chunks, { type: mimeType });
                        this.debugElement.textContent = "Status: Export finished.";
                        resolve(blob);
                    } else {
                        reject(new Error("Export resulted in an empty file."));
                    }
                };
                
                recorder.onerror = (e) => {
                    objectUrlsToRevoke.forEach(url => URL.revokeObjectURL(url));
                    if (audioContext) audioContext.close();
                    reject(e.error || new Error("MediaRecorder error"));
                };

                recorder.start(100);
                
                // Рендерим видео с эффектами
                await this.renderVideoWithEffectsImproved(ctx, canvas, recorder, objectUrlsToRevoke);
                
                setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                    }
                }, 200);
            });
        } catch (error) {
            objectUrlsToRevoke.forEach(url => URL.revokeObjectURL(url));
            if (audioContext) audioContext.close().catch(e => console.warn("Error closing audio context:", e));
            throw error;
        }
    }

    async setupOriginalAudioForExportImproved(destination, audioContext, objectUrlsToRevoke) {
        const audioElements = [];
        
        // Создаем аудио элементы для каждого видео сегмента
        for (let i = 0; i < this.videos.length; i++) {
            const videoFile = this.videos[i];
            const audioSrc = URL.createObjectURL(videoFile);
            objectUrlsToRevoke.push(audioSrc);
            
            const audioElement = document.createElement('audio');
            audioElement.src = audioSrc;
            audioElement.muted = false;
            
            try {
                await new Promise((resolve, reject) => {
                    audioElement.onloadedmetadata = resolve;
                    audioElement.onerror = reject;
                    setTimeout(reject, 3000);
                });
                
                const sourceNode = audioContext.createMediaElementSource(audioElement);
                sourceNode.connect(destination);
                
                audioElements.push({
                    element: audioElement,
                    duration: this.durations[i] || 0
                });
                
            } catch (error) {
                console.warn(`Failed to setup audio from video ${i+1}:`, error);
            }
        }
        
        return audioElements;
    }

    async addOverlayAudioToMixImproved(destination, audioContext, objectUrlsToRevoke) {
        if (!this.audioFile) return;
        
        try {
            const audioSrc = URL.createObjectURL(this.audioFile);
            objectUrlsToRevoke.push(audioSrc);
            
            const audioElement = document.createElement('audio');
            audioElement.src = audioSrc;
            audioElement.loop = false;
            
            await new Promise((resolve, reject) => {
                audioElement.onloadedmetadata = resolve;
                audioElement.onerror = () => reject(new Error("Failed to load overlay audio"));
                setTimeout(reject, 3000);
            });
            
            const sourceNode = audioContext.createMediaElementSource(audioElement);
            sourceNode.connect(destination);
            
            audioElement.currentTime = 0;
            await audioElement.play();
            
        } catch (error) {
            console.warn("Failed to add overlay audio to mix:", error);
        }
    }

    async renderVideoWithEffectsImproved(ctx, canvas, recorder, objectUrlsToRevoke) {
        this.debugElement.textContent = "Status: Rendering video with effects...";
        
        for (let i = 0; i < this.videos.length; i++) {
            if (recorder.state !== 'recording') break;
            
            const videoFile = this.videos[i];
            const segmentDuration = this.durations[i] || 0;
            
            if (segmentDuration <= 0) continue;
            
            try {
                const segmentSrc = URL.createObjectURL(videoFile);
                objectUrlsToRevoke.push(segmentSrc);
                
                const segmentVideo = document.createElement('video');
                segmentVideo.src = segmentSrc;
                segmentVideo.muted = true;
                
                await new Promise((resolve, reject) => {
                    segmentVideo.onloadedmetadata = resolve;
                    segmentVideo.onerror = () => reject(new Error(`Failed to load segment ${i+1}`));
                    setTimeout(reject, 5000);
                });
                
                segmentVideo.currentTime = 0;
                await segmentVideo.play();
                
                const startTime = Date.now();
                const targetDuration = segmentDuration * 1000;
                
                while (Date.now() - startTime < targetDuration && !segmentVideo.ended && recorder.state === 'recording') {
                    // Рисуем кадр
                    ctx.drawImage(segmentVideo, 0, 0, canvas.width, canvas.height);
                    
                    // Применяем фильтры если есть
                    this.applyFiltersToCanvas(ctx, canvas);
                    
                    // Добавляем текст если есть
                    this.renderTextOnCanvas(ctx, canvas);
                    
                    // Ждем следующий кадр
                    await new Promise(resolve => setTimeout(resolve, 33)); // ~30 FPS
                }
                
                segmentVideo.pause();
                
            } catch (error) {
                console.error(`Error processing video segment ${i+1}:`, error);
            }
        }
    }

    applyFiltersToCanvas(ctx, canvas) {
        const filterProcessor = this.processors?.filter;
        if (!filterProcessor || !filterProcessor.currentFilter) return;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        switch (filterProcessor.currentFilter) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }
                break;
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
                }
                break;
            case 'invert':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                break;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    renderTextOnCanvas(ctx, canvas) {
        const textProcessor = this.processors?.text;
        if (!textProcessor || !textProcessor.textElement) return;
        
        // Проверяем есть ли текст в div элементах или в textContent
        const textDivs = textProcessor.textElement.querySelectorAll('div');
        let lines = [];
        
        if (textDivs.length > 0) {
            lines = Array.from(textDivs).map(div => div.textContent).filter(line => line.trim());
        } else if (textProcessor.textElement.textContent) {
            lines = [textProcessor.textElement.textContent];
        }
        
        if (lines.length === 0) return;
        
        const fontSize = parseInt(textProcessor.textElement.style.fontSize) || 24;
        const color = textProcessor.textElement.style.color || '#ffffff';
        const position = textProcessor.textElement.dataset.position || 'top-left';
        
        // Адаптивный размер шрифта для canvas
        const scaledFontSize = Math.max(12, Math.min(fontSize, canvas.width / 20));
        
        ctx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, scaledFontSize / 15);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        const lineHeight = scaledFontSize * 1.3;
        const margin = Math.max(10, canvas.width * 0.03);
        const maxWidth = canvas.width - (margin * 2);
        
        // Разбиваем длинные строки чтобы поместились в canvas
        const wrappedLines = [];
        lines.forEach(line => {
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        wrappedLines.push(currentLine);
                        currentLine = word;
                    } else {
                        // Если одно слово слишком длинное, обрезаем его
                        wrappedLines.push(word.substring(0, Math.floor(maxWidth / (scaledFontSize * 0.6))));
                    }
                }
            });
            
            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        });
        
        // Ограничиваем количество строк чтобы поместились в видео
        const maxLines = Math.floor((canvas.height - margin * 2) / lineHeight);
        const finalLines = wrappedLines.slice(0, maxLines);
        
        const totalHeight = finalLines.length * lineHeight;
        
        // Определяем начальную позицию
        let startX, startY;
        
        switch (position) {
            case 'top-left':
                startX = margin;
                startY = margin;
                break;
            case 'top-right':
                startX = canvas.width - margin;
                startY = margin;
                ctx.textAlign = 'right';
                break;
            case 'bottom-left':
                startX = margin;
                startY = Math.max(margin, canvas.height - totalHeight - margin);
                break;
            case 'bottom-right':
                startX = canvas.width - margin;
                startY = Math.max(margin, canvas.height - totalHeight - margin);
                ctx.textAlign = 'right';
                break;
            default:
                startX = margin;
                startY = margin;
        }
        
        // Рисуем каждую строку с обводкой
        finalLines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Проверяем что текст не выходит за границы
            if (y + scaledFontSize <= canvas.height - margin) {
                ctx.strokeText(line, startX, y);
                ctx.fillText(line, startX, y);
            }
        });
    }

    async removeVideo(index) { 
        if (index >= 0 && index < this.videos.length) {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';
            
            const removedVideo = this.videos.splice(index, 1)[0];
            
            await this.loadMediaDurations(); // Recalculate all durations
            
            // Adjust currentIndex and currentTimeOffset
            if (this.currentIndex >= this.videos.length && this.videos.length > 0) {
                this.currentIndex = this.videos.length - 1;
            } else if (this.videos.length === 0) {
                this.currentIndex = 0;
            }
            
            this.currentTimeOffset = 0;
            for(let i = 0; i < this.currentIndex; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) {
                    this.currentTimeOffset += this.durations[i];
                }
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