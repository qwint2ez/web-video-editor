export class FilterApplier {
    constructor(videoElement, debugElement) {
      this.videoElement = videoElement;
      this.debugElement = debugElement;
    }
  
    applyFilter(filter) {
      if (!filter) {
        this.debugElement.textContent = 'Status: Error! Select a filter';
        throw new Error('Select a filter');
      }
  
      this.videoElement.style.filter = '';
      if (filter === 'grayscale') {
        this.videoElement.style.filter = 'grayscale(100%)';
      } else if (filter === 'sepia') {
        this.videoElement.style.filter = 'sepia(100%)';
      } else if (filter === 'invert') {
        this.videoElement.style.filter = 'invert(100%)';
      }
  
      this.debugElement.textContent = `Status: Applied filter ${filter}`;
    }
  }