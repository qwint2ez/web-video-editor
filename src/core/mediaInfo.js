export class MediaInfo {
    async getVideoDuration(file) {
        return new Promise((resolve) => {
            if (!file || !(file instanceof Blob || file instanceof File)) {
                console.error("Invalid file provided to getVideoDuration:", file);
                resolve(0);
                return;
            }
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
            const timeout = setTimeout(() => {
                console.warn("Video duration loading timeout for:", file.name);
                URL.revokeObjectURL(srcUrl);
                video.remove();
                resolve(0);
            }, 10000);
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                const duration = video.duration;
                URL.revokeObjectURL(srcUrl);
                video.remove();
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            video.onerror = (e) => {
                clearTimeout(timeout);
                URL.revokeObjectURL(srcUrl);
                video.remove();
                console.error(`Error loading video metadata for duration: ${file.name || 'unknown file'}`, e);
                resolve(0);
            };
        });
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
            const timeout = setTimeout(() => {
                console.warn("Audio duration loading timeout for:", file.name);
                URL.revokeObjectURL(srcUrl);
                audio.remove();
                resolve(0);
            }, 10000);
            audio.onloadedmetadata = () => {
                clearTimeout(timeout);
                const duration = audio.duration;
                URL.revokeObjectURL(srcUrl);
                audio.remove();
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            audio.onerror = () => {
                console.error("Error loading audio duration for file:", file.name || 'unknown file');
                URL.revokeObjectURL(srcUrl);
                audio.remove();
                resolve(0);
            };
        });
    }
}
