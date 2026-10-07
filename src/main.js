import('./app.js').catch(error => {
  console.error('LaserScan Lab could not start', error);
  const notice = document.createElement('div');
  notice.className = 'startup-error';
  notice.setAttribute('role', 'alert');
  notice.textContent = 'LaserScan Lab could not start. Use a browser with WebGL enabled, check that all application files loaded, and reload the page.';
  document.body.appendChild(notice);
});
