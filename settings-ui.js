(() => {
  "use strict";

  const inputApi = globalThis.NEON_BRAWL_INPUT;
  if (!inputApi) throw new Error("Input manager must load before settings-ui.js");

  const METHOD_LABELS = Object.freeze({
    keyboard: "TECLADO",
    gamepad: "MANDO",
    touch: "TÁCTIL",
  });

  class NeonBrawlSettingsUI {
    constructor(input, options = {}) {
      this.input = input;
      this.options = options;
      this.screen = document.querySelector("#settings-screen");
      this.closeButton = document.querySelector("#settings-close");
      this.resetAllButton = document.querySelector("#settings-reset-all");
      this.captureStatus = document.querySelector("#binding-capture-status");
      this.deviceStatus = document.querySelector("#settings-device-status");
      this.contextLabel = document.querySelector("#settings-context-label");
      this.contextMode = document.querySelector("#settings-context-mode");
      this.contextTitle = document.querySelector("#settings-context-title");
      this.contextCopy = document.querySelector("#settings-context-copy");
      this.activeProfile = document.querySelector("#settings-active-profile");
      this.playerTabsContainer = document.querySelector("#settings-player-tabs");
      this.touchMode = document.querySelector("#touch-mode");
      this.touchOpacity = document.querySelector("#touch-opacity");
      this.touchOpacityValue = document.querySelector("#touch-opacity-value");
      this.touchScale = document.querySelector("#touch-scale");
      this.touchScaleValue = document.querySelector("#touch-scale-value");
      this.gamepadDeadzone = document.querySelector("#gamepad-deadzone");
      this.gamepadDeadzoneValue = document.querySelector("#gamepad-deadzone-value");
      this.soundMode = document.querySelector("#sound-mode");
      this.screenShakeMode = document.querySelector("#screen-shake-mode");
      this.controlHintsMode = document.querySelector("#control-hints-mode");
      this.fullscreenButton = document.querySelector("#settings-fullscreen-button");
      this.sectionTabs = [...document.querySelectorAll("[data-settings-section-target]")];
      this.sections = [...document.querySelectorAll("[data-settings-section]")];
      this.methodShortcuts = [...document.querySelectorAll("[data-method-shortcut]")];
      this.gamepadBindingButtons = [...document.querySelectorAll("[data-gamepad-binding-action]")];
      this.touchBindingSelects = [...document.querySelectorAll("[data-touch-binding-slot]")];
      this.resetGamepadButton = document.querySelector("#reset-gamepad-bindings");
      this.resetTouchButton = document.querySelector("#reset-touch-bindings");
      this.bindingButtons = [...document.querySelectorAll("[data-binding-player]")];
      this.playerTabs = [...document.querySelectorAll("[data-settings-player]")];
      this.playerPanels = [...document.querySelectorAll("[data-settings-panel]")];
      this.resetPlayerButtons = [...document.querySelectorAll("[data-reset-player]")];
      this.awaitingBinding = null;
      this.awaitingGamepadBinding = null;
      this.activePlayer = 1;
      this.activeSection = "general";
      this.context = { inMatch: false, mode: "menu", round: 1 };
      this.populateTouchBindingOptions();
      this.bindEvents();
      this.input.onSettingsChange(() => {
        this.refresh();
        this.options.onSettingsChanged?.(this.input.getSettings());
      });
      this.input.onGamepadButtonPress?.(({ player, button }) => {
        this.captureGamepadButton(player, button);
      });
      this.input.onInputMethodChange?.(({ player }) => {
        if (Number(player) === this.activePlayer) this.refreshMethodStatus();
      });
      this.refresh();
    }

    bindEvents() {
      for (const tab of this.sectionTabs) {
        tab.addEventListener("click", () => this.showSection(tab.dataset.settingsSectionTarget));
      }
      for (const shortcut of this.methodShortcuts) {
        shortcut.addEventListener("click", () => this.showSection(shortcut.dataset.methodShortcut));
      }
      for (const tab of this.playerTabs) {
        tab.addEventListener("click", () => this.showPlayer(Number(tab.dataset.settingsPlayer)));
      }
      for (const button of this.bindingButtons) {
        button.addEventListener("click", () => this.beginBindingCapture(button));
      }
      for (const button of this.gamepadBindingButtons) {
        button.addEventListener("click", () => this.beginGamepadBindingCapture(button));
      }
      for (const select of this.touchBindingSelects) {
        select.addEventListener("change", () => {
          this.cancelBindingCapture();
          const saved = this.input.setTouchBinding(select.dataset.touchBindingSlot, select.value);
          this.captureStatus.textContent = saved
            ? "Diseño táctil actualizado. Las acciones duplicadas intercambiaron posiciones."
            : "No se pudo actualizar esa posición táctil.";
        });
      }
      for (const button of this.resetPlayerButtons) {
        button.addEventListener("click", () => {
          this.cancelBindingCapture();
          this.input.resetBindings(Number(button.dataset.resetPlayer));
          this.captureStatus.textContent = `Teclado de P${button.dataset.resetPlayer} restaurado.`;
        });
      }
      this.resetGamepadButton?.addEventListener("click", () => {
        this.cancelBindingCapture();
        this.input.resetGamepadBindings(this.activePlayer);
        this.captureStatus.textContent = `Mando de P${this.activePlayer} restaurado.`;
      });
      this.resetTouchButton?.addEventListener("click", () => {
        this.cancelBindingCapture();
        this.input.resetTouchBindings();
        this.captureStatus.textContent = "Diseño táctil restaurado.";
      });
      this.resetAllButton.addEventListener("click", () => {
        this.cancelBindingCapture();
        this.input.resetSettings();
        this.captureStatus.textContent = "Todos los ajustes fueron restaurados.";
      });
      this.closeButton.addEventListener("click", () => this.options.onClose?.());
      this.fullscreenButton?.addEventListener("click", () => this.options.onToggleFullscreen?.());
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
      this.soundMode.addEventListener("change", () => {
        this.input.setPreference("soundEnabled", this.soundMode.value === "on");
      });
      this.screenShakeMode.addEventListener("change", () => {
        this.input.setPreference("screenShake", this.screenShakeMode.value);
      });
      this.controlHintsMode.addEventListener("change", () => {
        this.input.setPreference("showControlHints", this.controlHintsMode.value === "on");
      });
    }

    populateTouchBindingOptions() {
      for (const select of this.touchBindingSelects) {
        if (select.options?.length) continue;
        for (const action of inputApi.ACTIONS) {
          const option = document.createElement("option");
          option.value = action.id;
          option.textContent = action.label.toUpperCase();
          select.append(option);
        }
      }
    }

    get isOpen() {
      return !this.screen.classList.contains("is-hidden");
    }

    open(context = {}) {
      this.context = {
        inMatch: Boolean(context.inMatch),
        mode: context.mode || "menu",
        round: Number(context.round) || 1,
      };
      const requestedPlayer = Number(context.player) || this.input.getMostRecentPlayer?.() || 1;
      this.showPlayer(requestedPlayer);
      const activeMethod = this.input.getActiveInputMethod?.(this.activePlayer) || "keyboard";
      this.showSection(this.context.inMatch ? activeMethod : "general");
      this.screen.dataset.context = this.context.inMatch ? "match" : "menu";
      this.closeButton.textContent = this.context.inMatch ? "VOLVER AL COMBATE" : "GUARDAR Y VOLVER";
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

    showSection(section) {
      const validSection = ["general", ...inputApi.INPUT_METHODS].includes(section) ? section : "general";
      this.activeSection = validSection;
      for (const tab of this.sectionTabs) {
        tab.classList.toggle("is-active", tab.dataset.settingsSectionTarget === validSection);
      }
      for (const panel of this.sections) {
        panel.classList.toggle("is-hidden", panel.dataset.settingsSection !== validSection);
      }
      this.playerTabsContainer.classList.toggle("is-hidden", !["keyboard", "gamepad"].includes(validSection));
      if (validSection === "touch") this.showPlayer(1);
      this.cancelBindingCapture();
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
      this.refreshGamepadLabels();
      this.refreshMethodStatus();
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

    beginGamepadBindingCapture(button) {
      this.cancelBindingCapture();
      this.awaitingGamepadBinding = {
        player: this.activePlayer,
        action: button.dataset.gamepadBindingAction,
        button,
      };
      button.classList.add("is-listening");
      button.textContent = "PRESS BUTTON";
      this.captureStatus.textContent = `Presiona un botón del mando de P${this.activePlayer}. MENU / OPTIONS está reservado para pausa.`;
    }

    captureGamepadButton(player, button) {
      if (!this.awaitingGamepadBinding || Number(player) !== this.awaitingGamepadBinding.player) return false;
      const { action } = this.awaitingGamepadBinding;
      const saved = this.input.setGamepadBinding(player, action, button);
      this.cancelBindingCapture(saved
        ? `Mando actualizado: ${inputApi.formatGamepadButton(button)}.`
        : "MENU / OPTIONS está reservado para pausa. Elige otro botón.");
      return true;
    }

    cancelBindingCapture(message = "Selecciona un control para reasignarlo. ESC cancela.") {
      if (this.awaitingBinding) this.awaitingBinding.button.classList.remove("is-listening");
      if (this.awaitingGamepadBinding) this.awaitingGamepadBinding.button.classList.remove("is-listening");
      this.awaitingBinding = null;
      this.awaitingGamepadBinding = null;
      this.captureStatus.textContent = message;
      this.refreshBindingLabels();
      this.refreshGamepadLabels();
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

    refreshGamepadLabels() {
      for (const button of this.gamepadBindingButtons) {
        if (this.awaitingGamepadBinding?.button === button) continue;
        button.textContent = inputApi.formatGamepadButton(
          this.input.getGamepadBinding(this.activePlayer, button.dataset.gamepadBindingAction),
        );
      }
      const playerLabel = document.querySelector("#gamepad-mapping-player");
      if (playerLabel) playerLabel.textContent = `PLAYER ${this.activePlayer}`;
    }

    refreshTouchBindings() {
      for (const select of this.touchBindingSelects) {
        select.value = this.input.getTouchBinding(select.dataset.touchBindingSlot);
      }
    }

    refreshMethodStatus() {
      const method = this.input.getActiveInputMethod?.(this.activePlayer) || "keyboard";
      const gamepads = this.input.getConnectedGamepads();
      this.deviceStatus.dataset.connected = String(gamepads.length > 0);
      this.deviceStatus.dataset.method = method;
      this.deviceStatus.querySelector("span").textContent = `USANDO ${METHOD_LABELS[method]}`;
      this.deviceStatus.querySelector("small").textContent = `PLAYER ${this.activePlayer} · ${gamepads.length} ${gamepads.length === 1 ? "MANDO" : "MANDOS"}`;
      for (const shortcut of this.methodShortcuts) {
        shortcut.classList.toggle("is-active", shortcut.dataset.methodShortcut === method);
      }
      const keyboardState = document.querySelector("#keyboard-method-state");
      const gamepadState = document.querySelector("#gamepad-method-state");
      const touchState = document.querySelector("#touch-method-state");
      if (keyboardState) keyboardState.textContent = method === "keyboard" ? "EN USO" : "DISPONIBLE";
      if (gamepadState) gamepadState.textContent = method === "gamepad" ? "EN USO" : gamepads.length ? "DETECTADO" : "NO DETECTADO";
      if (touchState) touchState.textContent = method === "touch" ? "EN USO" : this.input.shouldShowTouchControls() ? "DISPONIBLE" : "OCULTO";
      this.activeProfile.textContent = `PLAYER ${this.activePlayer} · ${METHOD_LABELS[method]}`;
    }

    refreshContext() {
      if (this.context.inMatch) {
        const mode = this.context.mode === "practice" ? "PRACTICE" : this.context.mode === "local" ? "LOCAL" : "QUICK FIGHT";
        this.contextLabel.innerHTML = "<span></span> QUICK SETTINGS // FIGHT PAUSED";
        this.contextMode.textContent = `${mode} · ROUND ${this.context.round}`;
        this.contextTitle.textContent = "COMBATE EN PAUSA";
        this.contextCopy.textContent = "Ajusta el método que estás usando y vuelve al combate. El balance, el reloj y el estado de los peleadores no cambian.";
      } else {
        this.contextLabel.innerHTML = "<span></span> SYSTEM CONFIGURATION // v3";
        this.contextMode.textContent = "MAIN MENU";
        this.contextTitle.textContent = "CONFIGURACIÓN COMPLETA";
        this.contextCopy.textContent = "Configura tus dispositivos antes de entrar al octágono. Los cambios se guardan automáticamente en este navegador.";
      }
    }

    refresh() {
      const settings = this.input.getSettings();
      this.refreshBindingLabels();
      this.refreshGamepadLabels();
      this.refreshTouchBindings();
      this.touchMode.value = settings.touchMode;
      this.touchOpacity.value = Math.round(settings.touchOpacity * 100);
      this.touchOpacityValue.textContent = `${Math.round(settings.touchOpacity * 100)}%`;
      this.touchScale.value = Math.round(settings.touchScale * 100);
      this.touchScaleValue.textContent = `${Math.round(settings.touchScale * 100)}%`;
      this.gamepadDeadzone.value = Math.round(settings.gamepadDeadzone * 100);
      this.gamepadDeadzoneValue.textContent = `${Math.round(settings.gamepadDeadzone * 100)}%`;
      this.soundMode.value = settings.soundEnabled ? "on" : "off";
      this.screenShakeMode.value = settings.screenShake;
      this.controlHintsMode.value = settings.showControlHints ? "on" : "off";
      this.refreshMethodStatus();
      this.refreshContext();
    }

    refreshDevices() {
      this.refreshMethodStatus();
    }
  }

  const api = { NeonBrawlSettingsUI, METHOD_LABELS };
  globalThis.NEON_BRAWL_SETTINGS_UI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
