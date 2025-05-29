export class TimelineUIManager {
    constructor(timelineBarElement, videoMergerInstance, videoElement) {
        this.timelineBar = timelineBarElement;
        this.merger = videoMergerInstance; // VideoMerger instance
        this.videoElement = videoElement; // Main video element for time updates
        this.cursor = null;
        this.progress = null;

        this.handleTimelineBarClick = this.handleTimelineBarClick.bind(this);
        this.updateTimeDisplay = this.updateTimeDisplay.bind(this); // Bind if it uses this.merger etc.
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
            // Ensure progress is added before cursor for correct z-index behavior if not handled by CSS
            this.timelineBar.insertBefore(this.progress, this.cursor);
        }
        this.updateTimeDisplay();
    }

    async handleTimelineBarClick(e) {
        if (!this.merger || e.target.classList.contains('delete-btn') || !Number.isFinite(this.merger.totalDuration) || this.merger.totalDuration <= 0) return;
        const rect = this.timelineBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = this.merger.totalDuration * pos;
        await this.merger.seekTo(time);
    }

    updateTimeDisplay() {
        if (!this.merger) return;

        const currentTime = this.merger.getCurrentTime();
        const validCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
        const validTotalDuration = Number.isFinite(this.merger.totalDuration) ? this.merger.totalDuration : 0;

        const percentage = (validTotalDuration > 0) ? (validCurrentTime / validTotalDuration) * 100 : 0;
        const safePercentage = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));

        if (this.cursor) {
            this.cursor.style.left = `${safePercentage}%`;
        }
        if (this.progress) {
            this.progress.style.width = `${safePercentage}%`;
        }

        const currentTimeDisplayEl = document.getElementById('currentTime');
        if (currentTimeDisplayEl) {
            currentTimeDisplayEl.textContent = this.merger.formatTime(validCurrentTime);
        }
        const totalDurationDisplayEl = document.getElementById('duration');
        if (totalDurationDisplayEl) {
            totalDurationDisplayEl.textContent = this.merger.formatTime(validTotalDuration);
        }
    }

    updateTimelineSegments() {
        if (!this.timelineBar || !this.merger) {
            console.error("Timeline bar or merger not found for segment update");
            return;
        }

        // Clear only segments, not cursor/progress if they are managed separately
        const segments = this.timelineBar.querySelectorAll('.timeline-segment');
        segments.forEach(seg => seg.remove());

        let currentVideoOffset = 0;
        let timelineBarActualHeight = 40;

        if (this.merger.videos && this.merger.videos.length > 0) {
            this.merger.videos.forEach((_video, index) => {
                const segment = document.createElement('div');
                segment.className = 'timeline-segment video-segment';
                
                const segmentDuration = (Number.isFinite(this.merger.durations[index]) && this.merger.durations[index] >= 0) 
                    ? this.merger.durations[index] 
                    : 0;
                
                let widthPercent = 0;
                let leftPercent = 0;
                
                if (this.merger.totalDuration > 0) {
                    widthPercent = (segmentDuration / this.merger.totalDuration) * 100;
                    leftPercent = (currentVideoOffset / this.merger.totalDuration) * 100;
                } else if (this.merger.videos.length > 0) { 
                    widthPercent = 100 / this.merger.videos.length;
                    leftPercent = (index * 100) / this.merger.videos.length;
                }
                
                if (widthPercent > 0 && widthPercent < 1) widthPercent = 1; // Min visible width
                
                segment.style.width = `${Math.max(0, Math.min(100, widthPercent))}%`;
                segment.style.left = `${Math.max(0, Math.min(100 - widthPercent, leftPercent))}%`;
                segment.style.top = '0px';
                segment.style.height = '40px'; 
                
                segment.style.background = segmentDuration === 0 ? 
                    'repeating-linear-gradient(45deg, #e74c3c, #e74c3c 10px, #c0392b 10px, #c0392b 20px)' : 
                    '#3498db';
                if (segmentDuration === 0) segment.style.opacity = '0.7';
                
                const label = document.createElement('div');
                label.className = 'video-info';
                const startNum = Number.isFinite(currentVideoOffset) ? currentVideoOffset : 0;
                const endNum = startNum + segmentDuration;
                label.textContent = `Video ${index + 1} (${this.merger.formatTime(startNum)}-${this.merger.formatTime(endNum)})`;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.merger.removeVideo(index);
                };
                
                segment.appendChild(label);
                segment.appendChild(deleteBtn);
                this.timelineBar.appendChild(segment); // Appends after cursor/progress if they were first
                
                currentVideoOffset += segmentDuration;
            });
        }
        
        if (this.merger.audioFile) {
            const audioTrackHeight = 25;
            const gap = 5; 
            const audioTopPos = (this.merger.videos && this.merger.videos.length > 0 ? timelineBarActualHeight : 0) + gap;
            
            timelineBarActualHeight = audioTopPos + audioTrackHeight;
            
            const audioSegment = document.createElement('div');
            audioSegment.className = 'timeline-segment audio-segment';
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
            const audioName = this.merger.audioFile.name || 'Audio File';
            const finiteAudioDuration = (Number.isFinite(this.merger.audioDuration) && this.merger.audioDuration >= 0) ? this.merger.audioDuration : 0;
            audioLabel.textContent = `♪ ${audioName.substring(0, 20)}${audioName.length > 20 ? '...' : ''} (${this.merger.formatTime(finiteAudioDuration)})`;

            const deleteAudioBtn = document.createElement('button');
            deleteAudioBtn.className = 'delete-btn audio-delete';
            deleteAudioBtn.textContent = '×';
            deleteAudioBtn.style.top = '2px'; 
            deleteAudioBtn.style.right = '2px';
            deleteAudioBtn.style.background = '#e17055';
            deleteAudioBtn.onclick = (e) => {
                e.stopPropagation();
                this.merger.removeAudio();
            };
            
            audioSegment.appendChild(audioLabel);
            audioSegment.appendChild(deleteAudioBtn);
            this.timelineBar.appendChild(audioSegment);
        }
        
        const minHeight = (this.merger.videos && this.merger.videos.length > 0) || this.merger.audioFile ? 
            (this.merger.audioFile && (!this.merger.videos || this.merger.videos.length === 0) ? 30 : timelineBarActualHeight) : 0;
        this.timelineBar.style.height = `${Math.max(minHeight, timelineBarActualHeight)}px`;
        
        // Ensure cursor and progress are on top or correctly placed
        if (this.progress && this.progress.parentNode !== this.timelineBar) this.timelineBar.appendChild(this.progress);
        if (this.cursor && this.cursor.parentNode !== this.timelineBar) this.timelineBar.appendChild(this.cursor);

        this.updateTimeDisplay();
    }
}
