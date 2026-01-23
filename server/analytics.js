import { PostHog } from 'posthog-node';
import os from 'os';

class GameAnalytics {
    constructor() {
        this.client = null;
        this.enabled = false;
        this.serverInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            nodeVersion: process.version
        };
    }

    init(apiKey) {
        if (!apiKey || apiKey === 'YOUR_POSTHOG_KEY') {
            console.log('Analytics: No valid API Key provided. Analytics disabled (Console logging only).');
            this.enabled = false;
            return;
        }

        try {
            this.client = new PostHog(apiKey, { host: 'https://us.i.posthog.com' }); // Default to US cloud
            this.enabled = true;
            console.log('Analytics: PostHog initialized successfully.');
        } catch (err) {
            console.error('Analytics: Failed to initialize PostHog', err);
            this.enabled = false;
        }
    }

    track(event, distinctId, properties = {}) {
        const payload = {
            distinctId: distinctId || 'anonymous_server',
            event: event,
            properties: {
                ...properties,
                ...this.serverInfo,
                timestamp: Date.now()
            }
        };

        if (this.enabled && this.client) {
            try {
                this.client.capture(payload);
            } catch (err) {
                console.error(`Analytics: Error capturing event ${event}`, err);
            }
        } else {
            // Dev/Debug mode logging
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Analytics] ${event} (${distinctId}):`, properties);
            }
        }
    }

    shutdown() {
        if (this.client) {
            this.client.shutdown();
        }
    }
}

export const Analytics = new GameAnalytics();
