export class InputHandler {
    constructor() {
        this.keys = new Set();
        this.state = { left: false, right: false, jump: false, crouch: false, attack1: false, attack2: false };
        this.bindEvents();
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
        });
    }

    getState() {
        this.state.left = this.keys.has('a') || this.keys.has('arrowleft');
        this.state.right = this.keys.has('d') || this.keys.has('arrowright');
        this.state.jump = this.keys.has('w') || this.keys.has('arrowup') || this.keys.has(' ');
        this.state.crouch = this.keys.has('s') || this.keys.has('arrowdown');
        this.state.attack1 = this.keys.has('j');
        this.state.attack2 = this.keys.has('k');
        return this.state;
    }
}
