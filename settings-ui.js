(() => {
  "use strict";

  const inputApi = globalThis.NEON_BRAWL_INPUT;
  if (!inputApi) throw new Error("Input manager must load before settings-ui.js");

  class NeonBrawlSettingsUI {
    constructor(input, options = {}) {
      this.input = input;
      this.options = options;
      this.screen = document.querySelector("#settings-screen");
      this.closeButton = document.querySelector("#settings-close");
      this.resetAllButton = document.querySelector("#settings-reset-all");
      this.captureStatus = document.querySelector("#binding-capture-status");
      this.deviceStatus = document.querySelector("#settings-device-status");
      this.touchMode = document.querySelector("#touch-mode");
      this.touchOpacity = document.querySelector("#touch-opacity");
      this.touchOpacityValue = document.querySelector("#touch-opacity-value");
      this.touchScale = document.querySelector("#touch-scale");
      this.touchScaleValue = document.querySelector("#touch-scale-value");
      this.gamepadDeadzone = document.querySelector("#gamepad-deadzone");
      this.gamepadDeadzoneValue = document.querySelector("#gamepad-deadzone-value");
      this.bindingButtons = [...document.querySelectorAll("[data-binding-player]")];
      this.playerTabs = [...document.querySelectorAll("[data-settings-player]")];
      this.playerPanels = [...document.querySelectorAll("[data-settings-panel]")];
      this.resetPlayerButtons = [...document.querySelectorAll("[data-reset-player]")];
      this.awaitingBinding = null;
      this.activePlayer = 1;
      this.bindEvents();
      this.input.onSettingsChange(() => {
        this.refresh();
        this.options.onSettingsChanged?.(this.input.getSettings());
      });
      this.refresh();
    }

    bindEvents() {
      for (const tab of this.playerTabs) {
        tab.addEventListener("click", () => this.showPlayer(Number(tab.dataset.settingsPlayer)));
      }
      for (const button of this.bindingButtons) {
        button.addEventListener("click", () => this.beginBindingCapture(button));
      }
      for (const button of this.resetPlayerButtons) {
        button.addEventListener("click", () => {
          this.cancelBindingCapture();
          this.input.resetBindings(Number(button.dataset.resetPlayer));
        });
      }
      this.resetAllButton.addEventListener("click", () => {
        this.cancelBindingCapture();
        this.input.resetSettings();
      });
      this.closeButton.addEventListener("click", () => this.options.onClose?.());
      this.touchMode.addEventListener("change", () => {
        this.input.setPreference("touchMode", this.touchMode.value);
      });
      this.touchOpacity.addEventListener("input", () => {
        this.touchOpacityValue.textContent = `${this.touchOpacity.value}%`;
      });
      this.touchOpacity.addEventListener("change", () => {
        this.input.setPreference("touchOpacity", Number(this.touchOpacity.value) / 100);
      });
      this.touchScale.addEventListener("input", () => {
        this.touchScaleValue.textContent = `${this.touchScale.value}%`;
      });
      this.touchScale.addEventListener("change", () => {
        this.input.setPreference("touchScale", Number(this.touchScale.value) / 100);
      });
      this.gamepadDeadzone.addEventListener("input", () => {
        this.gamepadDeadzoneValue.textContent = `${this.gamepadDeadzone.value}%`;
      });
      this.gamepadDeadzone.addEventListener("change", () => {
        this.input.setPreference("gamepadDeadzone", Number(this.gamepadDeadzone.value) / 100);
      });
    }

    get isOpen() {
      return !this.screen.classList.contains("is-hidden");
    }

    open() {
      this.cancelBindingCapture();
      this.refresh();
      this.refreshDevices();
      this.screen.classList.remove("is-hidden");
      this.closeButton.focus();
    }

    close() {
      this.cancelBindingCapture();
      this.screen.classList.add("is-hidden");
    }

    showPlayer(player) {
      this.activePlayer = player === 2 ? 2 : 1;
      for (const tab of this.playerTabs) {
        tab.classList.toggle("is-active", Number(tab.dataset.settingsPlayer) === this.activePlayer);
      }
      for (const panel of this.playerPanels) {
        panel.classList.toggle("is-hidden", Number(panel.dataset.settingsPanel) !== this.activePlayer);
      }
      this.cancelBindingCapture();
    }

    beginBindingCapture(button) {
      this.cancelBindingCapture();
      this.awaitingBinding = {
        player: Number(button.dataset.bindingPlayer),
        action: button.dataset.bindingAction,
        button,
      };
      button.classList.add("is-listening");
      button.textContent = "PRESS KEY";
      this.captureStatus.textContent = "Presiona una tecla nueva. ESC cancela; las teclas repetidas intercambian su acción.";
    }

    cancelBindingCapture(message = "Selecciona una tecla para reasignarla. ESC cancela.") {
      if (this.awaitingBinding) this.awaitingBinding.button.classList.remove("is-listening");
      this.awaitingBinding = null;
      this.captureStatus.textContent = message;
      this.refreshBindingLabels();
    }

    captureKey(event) {
      if (!this.awaitingBinding) return false;
      event.preventDefault?.();
      event.stopPropagation?.();
      if (event.code === "Escape") {
        this.cancelBindingCapture("Cambio cancelado.");
        return true;
      }
      const { player, action } = this.awaitingBinding;
      const saved = this.input.setBinding(player, action, event.code);
      this.cancelBindingCapture(saved
        ? `Control actualizado: ${inputApi.formatCode(event.code)}.`
        : "Esa tecla está reservada por el sistema. Elige otra.");
      return true;
    }

    refreshBindingLabels() {
      for (const button of this.bindingButtons) {
        if (this.awaitingBinding?.button === button) continue;
        const player = Number(button.dataset.bindingPlayer);
        button.textContent = inputApi.formatCode(
          this.input.getBinding(player, button.dataset.bindingAction),
        );
      }
    }

    refresh() {
      const settings = this.input.getSettings();
      this.refreshBindingLabels();
      this.touchMode.value = settings.touchMode;
      this.touchOpacity.value = Math.round(settings.touchOpacity * 100);
      this.touchOpacityValue.textContent = `${Math.round(settings.touchOpacity * 100)}%`;
      this.touchScale.value = Math.round(settings.touchScale * 100);
      this.touchScaleValue.textContent = `${Math.round(settings.touchScale * 100)}%`;
      this.gamepadDeadzone.value = Math.round(settings.gamepadDeadzone * 100);
      this.gamepadDeadzoneValue.textContent = `${Math.round(settings.gamepadDeadzone * 100)}%`;
    }

    refreshDevices() {
      const gamepads = this.input.getConnectedGamepads();
      this.deviceStatus.dataset.connected = String(gamepads.length > 0);
      this.deviceStatus.querySelector("span").textContent = gamepads.length
        ? "MANDO DETECTADO"
        : "TECLADO ACTIVO";
      this.deviceStatus.querySelector("small").textContent = `${gamepads.length} ${gamepads.length === 1 ? "MANDO" : "MANDOS"}`;
    }
  }

  const api = { NeonBrawlSettingsUI };
  globalThis.NEON_BRAWL_SETTINGS_UI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
