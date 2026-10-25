import './styles.css';
import { DECK, render, mountAll } from './cards.js';

mountAll();

const hand = document.getElementById('hand');
const msg = document.getElementById('handMsg');
const reset = document.getElementById('handReset');
const COUNT = 7;

function deal() {
  hand.classList.remove('done');
  msg.classList.remove('on'); reset.classList.remove('on'); reset.tabIndex = -1;
  hand.innerHTML = '';
  const peterAt = Math.floor(Math.random() * COUNT);
  const pool = [...DECK].sort(() => Math.random() - .5);
  const spread = window.innerWidth < 640 ? 40 : 54;
  for (let i = 0; i < COUNT; i++) {
    const rot = (i - (COUNT - 1) / 2) * (spread / (COUNT - 1));
    const isPeter = i === peterAt;
    const card = isPeter ? null : pool[i];
    const name = isPeter ? 'Schwarzer Peter' : card.name;
    const slot = document.createElement('div');
    slot.className = 'slot dealing';
    slot.style.setProperty('--rot', rot + 'deg');
    slot.style.setProperty('--i', i);
    slot.style.zIndex = i + 1;
    slot.innerHTML = `
      <button type="button" class="card" aria-label="Card ${i + 1} of ${COUNT}">
        <span class="card-inner">
          <span class="card-face card-back"></span>
          <span class="card-face card-front ${isPeter ? 'is-peter' : ''}" data-card>${render(isPeter ? 'peter' : card.key)}</span>
        </span>
      </button>`;
    slot.addEventListener('animationend', () => slot.classList.remove('dealing'), { once: true });
    slot.querySelector('button').addEventListener('click', () => pick(slot, isPeter, name));
    hand.appendChild(slot);
  }
}

function pick(slot, isPeter, name) {
  if (hand.classList.contains('done')) return;
  hand.classList.add('done');
  slot.classList.add('picked');
  slot.style.zIndex = 50;
  setTimeout(() => {
    msg.innerHTML = isPeter
      ? '<span class="text-glut">You drew the cat.</span> Better pass it on.'
      : `You drew the ${name}. Safe, this time.`;
    msg.classList.add('on'); reset.classList.add('on'); reset.tabIndex = 0;
  }, 450);
}

reset.addEventListener('click', deal);
deal();

// "Got a code? Join a room."
const joinForm = document.getElementById('join-form');
const codeInput = document.getElementById('code');
const codeError = document.getElementById('code-error');
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z]{5}$/.test(code)) {
    codeError.hidden = false;
    codeInput.setAttribute('aria-invalid', 'true');
    codeInput.focus();
    return;
  }
  location.href = `/play.html?room=${code}`;
});
codeInput.addEventListener('input', () => {
  codeError.hidden = true;
  codeInput.removeAttribute('aria-invalid');
});
