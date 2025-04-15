export class AudioOverlay {
    constructor(videoElement, audioInput, debugElement) {
      this.videoElement = videoElement;
      this.audioInput = audioInput;
      this.debugElement = debugElement;
      this.audio = null;
    }
  
    applyAudio() {
      const audioFile = this.audioInput.files[0];
      if (!audioFile) {
        this.debugElement.textContent = 'Status: Error! Select an audio file';
        throw new Error('Select an audio file');
      }
  
      if (this.audio) {
        this.audio.pause();
      }
  
      this.audio = new Audio(URL.createObjectURL(audioFile));
      this.audio.loop = true;
  
      this.videoElement.addEventListener('play', () => this.audio.play());
      this.videoElement.addEventListener('pause', () => this.audio.pause());
      this.videoElement.addEventListener('seeked', () => {
        this.audio.currentTime = this.videoElement.currentTime;
      });
  
      this.debugElement.textContent = 'Status: Audio applied';
    }
  }