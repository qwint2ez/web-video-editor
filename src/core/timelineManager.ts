export class TimelineManager {
    private videos: Array<{
        file: File;
        duration: number;
        startTime: number;
    }>;

    private totalDuration: number;

    private currentVideoIndex: number;

    constructor() {
        this.videos = [];
        this.totalDuration = 0;
        this.currentVideoIndex = 0;
    }

    addVideo(video: File) {
        this.videos.push({
            file: video,
            duration: 0,
            startTime: this.totalDuration
        });
    }

    async loadDurations() {
        for (const video of this.videos) {
            video.duration = await this.getVideoDuration(video.file);
            this.totalDuration += video.duration;
        }
    }

    getVideoAtTime(time: number) {
        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            accumulatedTime += this.videos[i].duration;
            if (time < accumulatedTime) {
                return {
                    index: i,
                    localTime: time - (accumulatedTime - this.videos[i].duration)
                };
            }
        }
        return null;
    }

    formatTime(seconds: number) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    private async getVideoDuration(file: File): Promise<number> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => resolve(video.duration);
            video.src = URL.createObjectURL(file);
        });
    }
}