export class InputHandler {
    constructor() {
        this.keys = new Set();
        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
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
        return {
            left: this.keys.has('a') || this.keys.has('arrowleft'),
            right: this.keys.has('d') || this.keys.has('arrowright'),
            jump: this.keys.has('w') || this.keys.has('arrowup') || this.keys.has(' '),
            crouch: this.keys.has('s') || this.keys.has('arrowdown'),
            attack1: this.keys.has('j'),
            attack2: this.keys.has('k'),
        };
    }
}
