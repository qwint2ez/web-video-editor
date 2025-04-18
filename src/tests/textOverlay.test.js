import { TextOverlay } from '../core/textOverlay.js';

describe('TextOverlay', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
      textElement: document.createElement('div'),
    };
    dependencies.textElement.id = 'textOverlay';
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
    document.body.appendChild(dependencies.textElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if text is empty', () => {
    const overlay = new TextOverlay(dependencies);
    expect(() => overlay.process({ text: '', position: 'top-left', color: '#ffffff', size: '16' })).toThrow('Text field cannot be empty');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! Text field cannot be empty');
  });

  test('should apply text correctly', () => {
    const overlay = new TextOverlay(dependencies);
    overlay.process({ text: 'Test Text', position: 'top-left', color: '#ff0000', size: '24' });

    expect(dependencies.textElement.textContent).toBe('Test Text');
    expect(dependencies.textElement.style.display).toBe('block');
    expect(dependencies.textElement.style.color).toBe('rgb(255, 0, 0)');
    expect(dependencies.textElement.style.fontSize).toBe('24px');
    expect(dependencies.textElement.style.top).toBe('10px');
    expect(dependencies.textElement.style.left).toBe('10px');
    expect(dependencies.debugElement.textContent).toBe('Status: Text "Test Text" added at top-left');
  });
});