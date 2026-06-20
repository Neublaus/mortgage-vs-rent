const masterInput = document.querySelector('#master-upload');
const imageInput = document.querySelector('#image-upload');
const masterCanvas = document.querySelector('#master-canvas');
const masterEmpty = document.querySelector('#master-empty');
const gallery = document.querySelector('#gallery');
const dropZone = document.querySelector('#drop-zone');
const automationDialog = document.querySelector('#automation-dialog');
const openAutomation = document.querySelector('#open-automation');
const closeAutomation = document.querySelector('#close-automation');
const launcherStatus = document.querySelector('#launcher-status');
const warmthValue = document.querySelector('#warmth-value');
const brightnessValue = document.querySelector('#brightness-value');
const contrastValue = document.querySelector('#contrast-value');

let masterTone = null;

const clamp = (value) => Math.max(0, Math.min(255, value));

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function drawImageToCanvas(image, canvas, maxWidth = 900) {
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
}

function analyzeTone(canvas) {
  const context = canvas.getContext('2d');
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let red = 0, green = 0, blue = 0, luminance = 0, luminanceSquared = 0, pixels = 0;

  for (let index = 0; index < data.length; index += 16) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    red += r; green += g; blue += b;
    luminance += luma;
    luminanceSquared += luma * luma;
    pixels += 1;
  }

  const avg = { red: red / pixels, green: green / pixels, blue: blue / pixels };
  const brightness = luminance / pixels;
  const variance = luminanceSquared / pixels - brightness * brightness;

  return { ...avg, brightness, contrast: Math.sqrt(Math.max(0, variance)) };
}

function updateToneReadout(tone) {
  const warmth = tone.red - tone.blue;
  warmthValue.textContent = `${warmth >= 0 ? '+' : ''}${warmth.toFixed(0)}`;
  brightnessValue.textContent = tone.brightness.toFixed(0);
  contrastValue.textContent = tone.contrast.toFixed(0);
}

function matchImageTone(sourceCanvas, tone) {
  const context = sourceCanvas.getContext('2d');
  const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const sourceTone = analyzeTone(sourceCanvas);
  const brightnessDelta = tone.brightness - sourceTone.brightness;
  const contrastRatio = sourceTone.contrast ? tone.contrast / sourceTone.contrast : 1;
  const colorDelta = {
    red: tone.red - sourceTone.red,
    green: tone.green - sourceTone.green,
    blue: tone.blue - sourceTone.blue,
  };

  for (let index = 0; index < imageData.data.length; index += 4) {
    for (const [offset, key] of [[0, 'red'], [1, 'green'], [2, 'blue']]) {
      const centered = imageData.data[index + offset] - sourceTone.brightness;
      imageData.data[index + offset] = clamp(
        sourceTone.brightness + centered * contrastRatio + brightnessDelta + colorDelta[key] * 0.75
      );
    }
  }

  context.putImageData(imageData, 0, 0);
}

async function setMaster(file) {
  const image = await loadImage(file);
  drawImageToCanvas(image, masterCanvas);
  masterTone = analyzeTone(masterCanvas);
  masterEmpty.hidden = true;
  launcherStatus.textContent = 'Master image loaded. Open the upload window to match images.';
  updateToneReadout(masterTone);
}

async function addMatchedImage(file) {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  drawImageToCanvas(image, canvas, 520);
  if (masterTone) matchImageTone(canvas, masterTone);

  const card = document.createElement('article');
  card.className = 'matched-card';
  const label = document.createElement('p');
  label.textContent = masterTone ? `${file.name} matched to master` : `${file.name} awaiting master`;
  card.append(canvas, label);
  gallery.prepend(card);
}

function openAutomationWindow() {
  if (typeof automationDialog.showModal === 'function') {
    automationDialog.showModal();
  } else {
    automationDialog.setAttribute('open', '');
  }
}

function closeAutomationWindow() {
  if (typeof automationDialog.close === 'function') {
    automationDialog.close();
  } else {
    automationDialog.removeAttribute('open');
  }
}

openAutomation.addEventListener('click', openAutomationWindow);
closeAutomation.addEventListener('click', closeAutomationWindow);
automationDialog.addEventListener('click', (event) => {
  if (event.target === automationDialog) closeAutomationWindow();
});

masterInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) setMaster(file);
});

imageInput.addEventListener('change', (event) => {
  [...event.target.files].forEach(addMatchedImage);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
  });
});

dropZone.addEventListener('drop', (event) => {
  [...event.dataTransfer.files]
    .filter((file) => file.type.startsWith('image/'))
    .forEach(addMatchedImage);
});
