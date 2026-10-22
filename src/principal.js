const destacadas = document.querySelector('.destacadas');
const numero = document.querySelector('#numero');
let actual = 0;
let intervalo;

function cambiarImagen() {
  const imagenes = destacadas.querySelectorAll('img');
  if (!imagenes.length) return;
  actual = actual % imagenes.length;
  imagenes[actual].classList.remove('activa');
  imagenes[actual].setAttribute('aria-hidden', 'true');
  actual = (actual + 1) % imagenes.length;
  imagenes[actual].classList.add('activa');
  imagenes[actual].removeAttribute('aria-hidden');
  numero.textContent = `${String(actual + 1).padStart(2, '0')} / ${String(imagenes.length).padStart(2, '0')}`;
}

function iniciarRotacion() {
  clearInterval(intervalo);
  // pausar si la pestaña esta oculta o si el usuario prefiere menos movimiento
  if (destacadas && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) intervalo = setInterval(cambiarImagen, 4000);
}
document.addEventListener('visibilitychange', iniciarRotacion);
window.addEventListener('contenido-actualizado', () => { actual = 0; iniciarRotacion(); });
iniciarRotacion();

// naveg compacta, accesible con teclado y sin bloquear el contenido, antiguamente daba error al hacer scroll, recordar
const botonMenu = document.querySelector('.menu-movil');
const navegacion = document.querySelector('#navegacion-publica');
function cerrarMenuPublico() {
  botonMenu.setAttribute('aria-expanded', 'false');
  navegacion.classList.remove('abierta');
}
botonMenu.addEventListener('click', () => {
  const abierto = botonMenu.getAttribute('aria-expanded') !== 'true';
  botonMenu.setAttribute('aria-expanded', String(abierto));
  navegacion.classList.toggle('abierta', abierto);
});
navegacion.addEventListener('click', evento => { if (evento.target.closest('a')) cerrarMenuPublico(); });
document.addEventListener('keydown', evento => {
  if (evento.key === 'Escape' && botonMenu.getAttribute('aria-expanded') === 'true') {
    cerrarMenuPublico(); botonMenu.focus();
  }
});
