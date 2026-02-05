export class InputHandler {
    constructor() {
        this.keys = new Set();
        this.state = { left: false, right: false, jump: false, crouch: false, attack1: false, attack2: false };
        this.touchState = { left: false, right: false, up: false, down: false, attack1: false, attack2: false };
        this.bindEvents();
        this.bindTouchEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            // Ignore if typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Prevent default scrolling for game keys
            // Added 's' and 'S' just in case, though usually only Arrow keys scroll
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 's', 'S'].includes(e.key)) {
                e.preventDefault();
            }
            this.keys.add(e.key.toLowerCase());
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
        });

        window.addEventListener('blur', () => {
            this.keys.clear();
            // Reset touch state on blur too
            Object.keys(this.touchState).forEach(k => this.touchState[k] = false);
        });
    }

    bindTouchEvents() {
        const touchMap = {
            'btn-left': 'left',
            'btn-right': 'right',
            'btn-up': 'up',
            'btn-down': 'down',
            'btn-punch': 'attack1',
            'btn-kick': 'attack2'
        };

        Object.entries(touchMap).forEach(([btnId, stateKey]) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const activate = (e) => {
                e.preventDefault(); // Prevent duplicate mouse events
                this.touchState[stateKey] = true;
                btn.classList.add('active');
            };

            const deactivate = (e) => {
                if (e) e.preventDefault();
                this.touchState[stateKey] = false;
                btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', activate, { passive: false });
            btn.addEventListener('touchend', deactivate);
            btn.addEventListener('touchcancel', deactivate);

            // Also support mouse clicks for testing on desktop
            btn.addEventListener('mousedown', activate);
            btn.addEventListener('mouseup', deactivate);
            btn.addEventListener('mouseleave', deactivate);
        });
    }

    getState() {
        this.state.left = this.keys.has('a') || this.keys.has('arrowleft') || this.touchState.left;
        this.state.right = this.keys.has('d') || this.keys.has('arrowright') || this.touchState.right;
        this.state.jump = this.keys.has('w') || this.keys.has('arrowup') || this.keys.has(' ') || this.touchState.up;
        this.state.crouch = this.keys.has('s') || this.keys.has('arrowdown') || this.touchState.down;
        this.state.attack1 = this.keys.has('j') || this.touchState.attack1;
        this.state.attack2 = this.keys.has('k') || this.touchState.attack2;
        return this.state;
    }
}
