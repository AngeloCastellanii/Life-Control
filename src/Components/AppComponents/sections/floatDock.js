const DOCK_KEY = 'lc_float_dock';
const DRAG_THRESHOLD = 8;

function clamp(value, min, max) {
   return Math.min(max, Math.max(min, value));
}

function readDockPosition() {
   try {
      const parsed = JSON.parse(localStorage.getItem(DOCK_KEY) || 'null');
      if (parsed && Number.isFinite(parsed.right) && Number.isFinite(parsed.bottom)) {
         return { right: parsed.right, bottom: parsed.bottom };
      }
   } catch {
      /* ignore */
   }
   return { right: 16, bottom: 80 };
}

function writeDockPosition(position) {
   try {
      localStorage.setItem(DOCK_KEY, JSON.stringify(position));
   } catch {
      /* ignore */
   }
}

export function applyDockPosition(dock = document.querySelector('.lc-float-dock')) {
   if (!dock) {
      return;
   }
   const { right, bottom } = readDockPosition();
   dock.style.right = `${right}px`;
   dock.style.bottom = `${bottom}px`;
   dock.style.left = 'auto';
   dock.style.top = 'auto';
}

export function ensureFloatDock() {
   let dock = document.querySelector('.lc-float-dock');
   if (dock) {
      applyDockPosition(dock);
      return dock;
   }
   dock = document.createElement('div');
   dock.className = 'lc-float-dock';
   dock.setAttribute('role', 'group');
   dock.setAttribute('aria-label', 'Accesos rápidos');
   document.body.appendChild(dock);
   applyDockPosition(dock);
   return dock;
}

export function mountInDock(el, position = 'append') {
   const dock = ensureFloatDock();
   if (!el) {
      return dock;
   }
   if (el.parentElement !== dock) {
      if (position === 'prepend') {
         dock.prepend(el);
      } else {
         dock.appendChild(el);
      }
   } else if (position === 'prepend' && dock.firstElementChild !== el) {
      dock.prepend(el);
   }
   return dock;
}

export function enableDockDrag(handle, dock = ensureFloatDock()) {
   if (!handle || handle.dataset.dockDrag === '1') {
      return;
   }
   handle.dataset.dockDrag = '1';
   handle.style.touchAction = 'none';

   let dragging = false;
   let moved = false;
   let startX = 0;
   let startY = 0;
   let startRight = 0;
   let startBottom = 0;

   const onMove = (event) => {
      if (!dragging) {
         return;
      }
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
         moved = true;
      }
      if (!moved) {
         return;
      }
      event.preventDefault();
      const nextRight = clamp(startRight - dx, 8, window.innerWidth - 72);
      const nextBottom = clamp(startBottom - dy, 72, window.innerHeight - 72);
      dock.style.right = `${nextRight}px`;
      dock.style.bottom = `${nextBottom}px`;
   };

   const onUp = (event) => {
      if (!dragging) {
         return;
      }
      dragging = false;
      handle._dockDidDrag = moved;
      writeDockPosition({
         right: Number.parseFloat(dock.style.right) || 16,
         bottom: Number.parseFloat(dock.style.bottom) || 80
      });
      try {
         handle.releasePointerCapture?.(event.pointerId);
      } catch {
         /* ignore */
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
   };

   const onDown = (event) => {
      if (event.button != null && event.button !== 0) {
         return;
      }
      const rect = dock.getBoundingClientRect();
      dragging = true;
      moved = false;
      handle._dockDidDrag = false;
      startX = event.clientX;
      startY = event.clientY;
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      try {
         handle.setPointerCapture?.(event.pointerId);
      } catch {
         /* ignore */
      }
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
   };

   handle.addEventListener('pointerdown', onDown);
   handle.addEventListener(
      'click',
      (event) => {
         if (!handle._dockDidDrag) {
            return;
         }
         event.preventDefault();
         event.stopImmediatePropagation();
         handle._dockDidDrag = false;
      },
      true
   );
}
