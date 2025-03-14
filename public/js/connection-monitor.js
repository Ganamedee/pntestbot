// File: public/js/connection-monitor.js

/**
 * A simple connection monitor to detect API availability issues
 * and show appropriate UI feedback to the user
 */
class ConnectionMonitor {
  constructor() {
    this.statusElement = document.getElementById("connection-status");
    this.statusDot = this.statusElement?.querySelector(".status-dot");
    this.statusText = this.statusElement?.querySelector(".status-text");
    this.isOnline = true;
    this.consecutiveFailures = 0;

    // Initialize
    this.setupEventListeners();
    this.checkConnection();

    // Run periodic checks
    setInterval(() => this.checkConnection(), 30000); // Check every 30 seconds
  }

  setupEventListeners() {
    // Listen for online/offline events
    window.addEventListener("online", () => this.setOnlineStatus(true));
    window.addEventListener("offline", () =>
      this.setOnlineStatus(false, "Your device is offline")
    );

    // Hide status after 5 seconds when online
    this.statusElement?.addEventListener("click", () => {
      if (this.isOnline) {
        this.hideStatus();
      }
    });
  }

  async checkConnection() {
    try {
      // Try to fetch the health endpoint
      const response = await fetch("/health", {
        method: "GET",
        // Add a cache buster
        headers: { "Cache-Control": "no-cache" },
        // Add timeout
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this.consecutiveFailures = 0;
        this.setOnlineStatus(true);
      } else {
        this.handleFailure("API service is having issues");
      }
    } catch (error) {
      this.handleFailure("Cannot connect to server");
    }
  }

  handleFailure(message) {
    this.consecutiveFailures++;

    // Only show offline status after multiple consecutive failures
    // to avoid false positives
    if (this.consecutiveFailures >= 2) {
      this.setOnlineStatus(false, message);
    }
  }

  setOnlineStatus(isOnline, message = "") {
    if (!this.statusElement) return;

    this.isOnline = isOnline;

    if (isOnline) {
      this.statusElement.className = "connection-status online visible";
      this.statusDot.className = "status-dot online";
      this.statusText.textContent = "Connected";

      // Hide the status after 3 seconds when online
      setTimeout(() => this.hideStatus(), 3000);
    } else {
      this.statusElement.className = "connection-status offline visible";
      this.statusDot.className = "status-dot offline";
      this.statusText.textContent = message || "Connection lost";
    }
  }

  hideStatus() {
    if (this.isOnline && this.statusElement) {
      this.statusElement.classList.remove("visible");
    }
  }
}

// Initialize when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.connectionMonitor = new ConnectionMonitor();
});

// No export statement - this works directly in the browser
