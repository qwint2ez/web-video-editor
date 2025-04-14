export class TextOverlay {
    constructor(videoElement, debugElement) {
      this.videoElement = videoElement;
      this.debugElement = debugElement;
      this.textElement = document.getElementById('textOverlay');
    }
  
    applyText(text, position, color, size) {
      if (!text) {
        this.debugElement.textContent = 'Status: Error! Text field cannot be empty';
        throw new Error('Text field cannot be empty');
      }
  
      this.textElement.textContent = text;
      this.textElement.style.display = 'block';
      this.textElement.style.color = color;
      this.textElement.style.fontSize = `${size}px`;
      this.textElement.style.top = '';
      this.textElement.style.bottom = '';
      this.textElement.style.left = '';
      this.textElement.style.right = '';
  
      switch (position) {
        case 'top-left':
          this.textElement.style.top = '10px';
          this.textElement.style.left = '10px';
          break;
        case 'top-right':
          this.textElement.style.top = '10px';
          this.textElement.style.right = '10px';
          break;
        case 'bottom-left':
          this.textElement.style.bottom = '10px';
          this.textElement.style.left = '10px';
          break;
        case 'bottom-right':
          this.textElement.style.bottom = '10px';
          this.textElement.style.right = '10px';
          break;
      }
  
      this.debugElement.textContent = `Status: Text "${text}" added at ${position}`;
    }
  }