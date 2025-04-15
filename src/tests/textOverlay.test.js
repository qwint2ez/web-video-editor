import { TextOverlay } from '../textOverlay.js';

describe('TextOverlay', () => {
  let videoElement, debugElement, textOverlayElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
    debugElement = document.createElement('p');
    textOverlayElement = document.createElement('div');
    textOverlayElement.id = 'textOverlay';
    document.body.appendChild(videoElement);
    document.body.appendChild(debugElement);
    document.body.appendChild(textOverlayElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if text is empty', () => {
    const overlay = new TextOverlay(videoElement, debugElement);
    expect(() => overlay.applyText('', 'top-left', '#ffffff', '16')).toThrow('Text field cannot be empty');
    expect(debugElement.textContent).toBe('Status: Error! Text field cannot be empty');
  });

  test('should apply text correctly', () => {
    const overlay = new TextOverlay(videoElement, debugElement);
    overlay.applyText('Test Text', 'top-left', '#ff0000', '24');

    expect(textOverlayElement.textContent).toBe('Test Text');
    expect(textOverlayElement.style.display).toBe('block');
    expect(textOverlayElement.style.color).toBe('rgb(255, 0, 0)'); // #ff0000
    expect(textOverlayElement.style.fontSize).toBe('24px');
    expect(textOverlayElement.style.top).toBe('10px');
    expect(textOverlayElement.style.left).toBe('10px');
    expect(debugElement.textContent).toBe('Status: Text "Test Text" added at top-left');
  });
});