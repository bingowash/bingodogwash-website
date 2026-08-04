const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');

function closeMenu() {
  menuButton.classList.remove('open');
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  document.body.style.overflow = '';
}

menuButton.addEventListener('click', () => {
  const opening = !nav.classList.contains('open');
  menuButton.classList.toggle('open', opening);
  nav.classList.toggle('open', opening);
  menuButton.setAttribute('aria-expanded', String(opening));
  menuButton.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
  document.body.style.overflow = opening ? 'hidden' : '';
});

nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...nav.querySelectorAll('a')];

window.addEventListener('scroll', () => {
  const current = sections.reduce((active, section) => {
    return window.scrollY >= section.offsetTop - 180 ? section.id : active;
  }, 'home');

  navLinks.forEach((link) => {
    const target = link.getAttribute('href').slice(1);
    const related = target === current || (current === 'how-it-works' && target === 'how-it-works') || (current === 'features' && target === 'features');
    link.classList.toggle('active', related);
  });
}, { passive: true });

const playButton = document.querySelector('.transport-play');
playButton.addEventListener('click', () => {
  const playing = playButton.textContent.trim() === 'Ⅱ';
  playButton.textContent = playing ? '▶' : 'Ⅱ';
  playButton.setAttribute('aria-label', playing ? 'Play preview' : 'Pause preview');
});
