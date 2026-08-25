// TestiMark Generator App Engine (100% Client-side Offline)

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const fileInput = document.getElementById('fileInput');
  const dropArea = document.getElementById('dropArea');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const canvas = document.getElementById('testiCanvas');
  const ctx = canvas.getContext('2d');
  
  const storeNameInput = document.getElementById('storeName');
  const storeHandleInput = document.getElementById('storeHandle');
  const tagTextInput = document.getElementById('tagText');
  const ratingStarsSelect = document.getElementById('ratingStars');
  const watermarkTextInput = document.getElementById('watermarkText');
  const badgePositionSelect = document.getElementById('badgePosition');
  const badgeColorSelect = document.getElementById('badgeColor');
  
  const showWatermarkBgCheck = document.getElementById('showWatermarkBg');
  const showVerifiedIconCheck = document.getElementById('showVerifiedIcon');
  const showBorderCheck = document.getElementById('showBorder');

  const btnDownload = document.getElementById('btnDownload');
  const btnChangeImage = document.getElementById('btnChangeImage');
  const imageDimensionsSpan = document.getElementById('imageDimensions');

  let currentImage = null;

  // Theme Color Configurations
  const themes = {
    emerald: { bg: '#064e3b', border: '#10b981', text: '#ffffff', tagBg: '#10b981', tagText: '#022c22' },
    purple: { bg: '#3b0764', border: '#a855f7', text: '#ffffff', tagBg: '#a855f7', tagText: '#3b0764' },
    cyan: { bg: '#164e63', border: '#06b6d4', text: '#ffffff', tagBg: '#06b6d4', tagText: '#083344' },
    amber: { bg: '#451a03', border: '#f59e0b', text: '#ffffff', tagBg: '#f59e0b', tagText: '#451a03' },
    dark: { bg: 'rgba(15, 23, 42, 0.92)', border: 'rgba(255, 255, 255, 0.2)', text: '#ffffff', tagBg: 'rgba(255, 255, 255, 0.15)', tagText: '#ffffff' }
  };

  // Drag and Drop Events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
  });

  dropArea.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    if (!file.type.match('image.*')) {
      alert('Mohon upload file gambar (PNG, JPG, JPEG, WEBP)!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        currentImage = img;
        uploadPlaceholder.style.display = 'none';
        canvas.style.display = 'block';
        btnDownload.disabled = false;
        btnChangeImage.style.display = 'inline-flex';
        renderCanvas();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Auto Render on Any Input Change
  const inputsToListen = [
    storeNameInput, storeHandleInput, tagTextInput, ratingStarsSelect,
    watermarkTextInput, badgePositionSelect, badgeColorSelect,
    showWatermarkBgCheck, showVerifiedIconCheck, showBorderCheck
  ];

  inputsToListen.forEach(input => {
    input.addEventListener('input', renderCanvas);
    input.addEventListener('change', renderCanvas);
  });

  // Render Canvas Function
  function renderCanvas() {
    if (!currentImage) return;

    const imgWidth = currentImage.naturalWidth || currentImage.width;
    const imgHeight = currentImage.naturalHeight || currentImage.height;

    // Set Canvas Dimensions to match Image Original High Resolution
    canvas.width = imgWidth;
    canvas.height = imgHeight;

    imageDimensionsSpan.textContent = `Resolusi: ${imgWidth} x ${imgHeight} px`;

    // 1. Draw Base Image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

    // 2. Draw Optional Frame Border
    if (showBorderCheck.checked) {
      const borderWidth = Math.max(12, Math.round(canvas.width * 0.015));
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = themes[badgeColorSelect.value].border;
      ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth);
    }

    // 3. Draw Optional Diagonal Watermark Text Background
    if (showWatermarkBgCheck.checked && watermarkTextInput.value.trim() !== '') {
      drawDiagonalWatermark(watermarkTextInput.value.trim());
    }

    // 4. Draw Testimonial Badge Card
    drawTestiBadge();
  }

  // Draw Diagonal Watermark Text Across Image
  function drawDiagonalWatermark(text) {
    ctx.save();
    const fontSize = Math.max(20, Math.round(canvas.width * 0.045));
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Translate to center and rotate
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6); // -30 degrees

    const textToRepeat = `${text}   •   ${text}   •   ${text}`;
    ctx.fillText(textToRepeat, 0, -fontSize * 1.5);
    ctx.fillText(textToRepeat, 0, 0);
    ctx.fillText(textToRepeat, 0, fontSize * 1.5);

    ctx.restore();
  }

  // Draw Testimonial Badge Overlay Card
  function drawTestiBadge() {
    const theme = themes[badgeColorSelect.value];
    const storeName = storeNameInput.value.trim() || 'Kedai Premium';
    const storeHandle = storeHandleInput.value.trim() || '@kedaipremium';
    const tagText = tagTextInput.value.trim() || 'REAL TESTIMONI';
    const starsCount = parseInt(ratingStarsSelect.value) || 5;
    const starsStr = '★'.repeat(starsCount) + '☆'.repeat(5 - starsCount);

    // Dynamic Sizing based on canvas scale
    const scale = Math.max(0.6, canvas.width / 900);
    const cardWidth = Math.round(360 * scale);
    const cardHeight = Math.round(135 * scale);
    const padding = Math.round(16 * scale);
    const margin = Math.round(30 * scale);

    // Determine Position
    let x = margin;
    let y = margin;
    const pos = badgePositionSelect.value;

    if (pos === 'top-right') {
      x = canvas.width - cardWidth - margin;
      y = margin;
    } else if (pos === 'bottom-left') {
      x = margin;
      y = canvas.height - cardHeight - margin;
    } else if (pos === 'bottom-right') {
      x = canvas.width - cardWidth - margin;
      y = canvas.height - cardHeight - margin;
    }

    ctx.save();

    // Card Shadow & Background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.round(24 * scale);
    ctx.shadowOffsetY = Math.round(8 * scale);

    // Glass Background Card
    const cornerRadius = Math.round(16 * scale);
    ctx.fillStyle = theme.bg;
    ctx.beginPath();
    roundRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
    ctx.fill();

    // Card Border
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(2, Math.round(2 * scale));
    ctx.strokeStyle = theme.border;
    ctx.stroke();

    // Draw Tag Pill (Top Right of Card)
    const tagFontSize = Math.round(11 * scale);
    ctx.font = `800 ${tagFontSize}px "Plus Jakarta Sans", sans-serif`;
    const tagWidth = ctx.measureText(tagText).width + Math.round(16 * scale);
    const tagHeight = Math.round(22 * scale);
    const tagX = x + cardWidth - tagWidth - padding;
    const tagY = y + padding;

    ctx.fillStyle = theme.tagBg;
    ctx.beginPath();
    roundRect(ctx, tagX, tagY, tagWidth, tagHeight, Math.round(99 * scale));
    ctx.fill();

    ctx.fillStyle = theme.tagText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tagX + tagWidth / 2, tagY + tagHeight / 2 + Math.round(1 * scale));

    // Store Name + Verified Icon
    const titleFontSize = Math.round(17 * scale);
    ctx.font = `700 ${titleFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const nameY = y + padding + Math.round(2 * scale);
    ctx.fillText(storeName, x + padding, nameY);

    if (showVerifiedIconCheck.checked) {
      const nameWidth = ctx.measureText(storeName).width;
      const checkX = x + padding + nameWidth + Math.round(6 * scale);
      const checkSize = Math.round(16 * scale);
      
      // Verified Circle
      ctx.fillStyle = '#38bdf8'; // Verified Blue
      ctx.beginPath();
      ctx.arc(checkX + checkSize/2, nameY + checkSize/2 + Math.round(2 * scale), checkSize/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Checkmark Symbol
      ctx.fillStyle = '#0f172a';
      ctx.font = `900 ${Math.round(10 * scale)}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', checkX + checkSize/2, nameY + checkSize/2 + Math.round(2 * scale));
    }

    // Handle Username
    const handleFontSize = Math.round(13 * scale);
    ctx.font = `500 ${handleFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(storeHandle, x + padding, nameY + titleFontSize + Math.round(4 * scale));

    // Rating Stars
    const starFontSize = Math.round(15 * scale);
    ctx.font = `${starFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#fbbf24'; // Amber Gold
    ctx.fillText(starsStr, x + padding, y + cardHeight - padding - Math.round(18 * scale));

    // Footer Verified Label
    const footFontSize = Math.round(11 * scale);
    ctx.font = `600 ${footFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText('✔ Verified Purchase', x + cardWidth - padding, y + cardHeight - padding - Math.round(15 * scale));

    ctx.restore();
  }

  // Helper Rounded Rectangle
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Instant Download PNG
  btnDownload.addEventListener('click', () => {
    if (!currentImage) return;

    const link = document.createElement('a');
    const storeNameClean = (storeNameInput.value || 'kedaipremium').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timeStamp = new Date().toISOString().slice(0, 10);
    
    link.download = `testi_${storeNameClean}_${timeStamp}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  });
});
