console.log('MAIN JS LOADED');

document.addEventListener('DOMContentLoaded', () => {
  document.body.style.background = '#05060a';
  document.body.style.color = '#e5e5e5';

  const test = document.createElement('div');
  test.textContent = 'JS IS RUNNING';
  test.style.position = 'fixed';
  test.style.top = '20px';
  test.style.right = '20px';
  test.style.padding = '10px';
  test.style.background = 'red';
  document.body.appendChild(test);
});
