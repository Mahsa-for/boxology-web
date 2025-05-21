// Auto-load Boxology plugin at startup
const script = document.createElement('script');
script.src = 'js/boxology/BoxologyValidation.js';
script.onload = () => console.log('✅ Boxology plugin loaded');
document.body.appendChild(script);
