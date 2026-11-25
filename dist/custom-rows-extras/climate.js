// Extra element voor custom-rows-card (thermostaat, type "climate").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  const DEFAULT_STEP = 0.5; // °C per klik bij een climate

  const CLIMATE_ICONS = {
    heat: "mdi:fire",
    cool: "mdi:snowflake",
    heat_cool: "mdi:sun-snowflake-variant",
    auto: "mdi:thermostat-auto",
    dry: "mdi:water-percent",
    fan_only: "mdi:fan",
    off: "mdi:power"
  };

  // Wat doet een climate nu? "heating", "cooling" of null (niet actief).
  // Volgt hvac_action; heeft het toestel dat attribuut niet, dan geldt de ingestelde modus.
  const climateAction = (state, { isAvailable }) => {
    if (!isAvailable(state)) return null;

    const action = state.attributes?.hvac_action ??
      (state.state === "heat" ? "heating" : state.state === "cool" ? "cooling" : null);

    if (action === "heating" || action === "preheating") return "heating";
    if (action === "cooling") return "cooling";

    return null;
  };

  const buildClimate = (card, extra, helpers) => {
    const { isAvailable, toNumber, NO_VALUE } = helpers;

    const el = document.createElement("div");
    el.className = "extra";

    const view = document.createElement("div");
    view.className = "extra-view";

    // Icoon (more-info) | naam boven status | voorinstelling-knop, temperatuur
    const info = card._iconButton(() => card._openMoreInfo(extra.entity));

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";

    const status = document.createElement("div");
    status.className = "extra-status";

    labels.append(name, status);

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    // Voorinstelling (preset_mode) kiezen in een pop-up
    const preset = card._iconButton(() => openPresetPopup());
    preset.setIcon("mdi:air-filter");

    // De temperatuur is een knop (rechts uitgelijnd): een klik opent de pop-up om hem aan te passen
    const value = document.createElement("button");
    value.type = "button";
    value.className = "stepper-value";
    value.style.cssText = "background:none;border:0;margin:0;padding:6px 0 6px 8px;color:inherit;" +
      "font-family:inherit;cursor:pointer;text-align:right;";
    value.addEventListener("click", () => openTemperaturePopup());

    stepper.append(preset.el, value);
    view.append(info.el, labels, stepper);
    el.append(view);

    // Lang indrukken op de rij: uit -> aan, anders -> uit
    el.classList.add("long-press");

    const disposeLongPress = card._onLongPress(el, () => {
      const state = card._getState(extra.entity);

      if (!isAvailable(state)) return;

      card._callService("climate", state.state === "off" ? "turn_on" : "turn_off", {
        entity_id: extra.entity
      });
    }, { canStart: () => isAvailable(card._getState(extra.entity)) });

    // ----- Pop-ups -----
    // Ze staan op document.body (buiten de kaart); daarom is de opmaak inline en gebruikt die alleen
    // de thema-variabelen van Home Assistant. Er is maximaal één pop-up tegelijk open.
    let popup = null;

    const closePopup = () => {
      if (!popup) return;

      document.removeEventListener("keydown", popup.onKey, true);
      popup.backdrop.remove();
      popup = null;
    };

    // Ronde icoonknop met hetzelfde uiterlijk als .icon-btn
    const roundButton = (icon, label, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.style.cssText = "display:flex;align-items:center;justify-content:center;flex-shrink:0;" +
        "box-sizing:border-box;width:32px;height:32px;padding:0;border:none;border-radius:50%;" +
        "cursor:pointer;font:inherit;--mdc-icon-size:20px;color:var(--secondary-text-color);" +
        "background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent);";

      const iconEl = document.createElement("ha-icon");
      iconEl.icon = icon;
      button.append(iconEl);
      button.addEventListener("click", onClick);

      button.setDisabled = (disabled) => {
        button.disabled = disabled;
        button.style.opacity = disabled ? "0.4" : "";
        button.style.cursor = disabled ? "default" : "pointer";
      };

      return button;
    };

    const textButton = (label, onClick, primary = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = "padding:8px 12px;font:inherit;border:0;border-radius:8px;background:transparent;" +
        `cursor:pointer;color:${primary ? "var(--primary-color)" : "var(--secondary-text-color)"};` +
        (primary ? "font-weight:500;" : "");
      button.addEventListener("click", onClick);

      return button;
    };

    // Basis van een pop-up: titel (naam van de entiteit), ondertitel en een lege inhoud.
    // dismissOnBackdrop: een klik naast de pop-up sluit hem (bij temperatuur niet: alleen
    // Annuleren, Escape of Bevestigen sluit die).
    const openDialog = (state, subtitle, { dismissOnBackdrop = true } = {}) => {
      closePopup();

      const backdrop = document.createElement("div");
      backdrop.style.cssText = "position:fixed;inset:0;z-index:1000;display:flex;align-items:center;" +
        "justify-content:center;box-sizing:border-box;padding:16px;background:rgba(0,0,0,0.5);" +
        "font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif);";

      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", subtitle);
      dialog.style.cssText = "box-sizing:border-box;width:100%;max-width:360px;padding:16px 20px;" +
        "border-radius:var(--ha-card-border-radius, 12px);" +
        "background:var(--ha-card-background, var(--card-background-color, #fff));" +
        "color:var(--primary-text-color);box-shadow:0 8px 32px rgba(0,0,0,0.35);";

      const heading = document.createElement("div");
      heading.textContent = extra.name || state.attributes?.friendly_name || extra.entity;
      heading.style.cssText = "font-size:1.2em;font-weight:500;overflow-wrap:anywhere;";

      const sub = document.createElement("div");
      sub.textContent = subtitle;
      sub.style.cssText = "margin:2px 0 12px;color:var(--secondary-text-color);";

      dialog.append(heading, sub);
      backdrop.append(dialog);

      if (dismissOnBackdrop) {
        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) closePopup();
        });
      }

      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        closePopup();
      };

      document.addEventListener("keydown", onKey, true);
      document.body.append(backdrop);
      popup = { backdrop, onKey };

      return dialog;
    };

    // Voorinstelling: dropdown met de beschikbare voorinstellingen; kiezen stelt direct in
    const presetLabel = (state, mode) => {
      try {
        return card._hass?.formatEntityAttributeValue?.(state, "preset_mode", mode) ?? mode;
      } catch (err) {
        return mode;
      }
    };

    const openPresetPopup = () => {
      const state = card._getState(extra.entity);
      const modes = state?.attributes?.preset_modes;

      if (!isAvailable(state) || !Array.isArray(modes) || !modes.length) return;

      const title = card._t("rows.climate_preset");
      const dialog = openDialog(state, title);

      const select = document.createElement("select");
      select.setAttribute("aria-label", title);
      select.style.cssText = "box-sizing:border-box;width:100%;padding:10px 12px;font:inherit;font-size:14px;" +
        "border:1px solid var(--divider-color);border-radius:8px;" +
        "background:var(--card-background-color, #fff);color:var(--primary-text-color);";

      const current = state.attributes?.preset_mode;

      // Staat het toestel op een waarde die niet in de lijst staat (of op geen), toon dan een lege keuze
      if (!modes.includes(current)) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = NO_VALUE;
        empty.disabled = true;
        empty.selected = true;
        select.append(empty);
      }

      modes.forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = presetLabel(state, mode);
        option.selected = mode === current;
        select.append(option);
      });

      select.addEventListener("change", () => {
        const mode = select.value;

        closePopup();
        if (mode && mode !== current) {
          card._callService("climate", "set_preset_mode", { entity_id: extra.entity, preset_mode: mode });
        }
      });

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;justify-content:flex-end;margin-top:12px;";
      actions.append(textButton(card._t("rows.close"), closePopup));

      dialog.append(select, actions);
      select.focus();
    };

    // Temperatuur: - waarde + op één regel; pas bij Bevestigen wordt de waarde ingesteld en sluit de pop-up
    const openTemperaturePopup = () => {
      const state = card._getState(extra.entity);
      const attrs = state?.attributes || {};
      const original = toNumber(attrs.temperature);

      if (!isAvailable(state) || original === null) return;

      const min = toNumber(attrs.min_temp);
      const max = toNumber(attrs.max_temp);
      const unit = card._hass?.config?.unit_system?.temperature || "°C";
      let target = original;

      const dialog = openDialog(state, card._t("rows.climate_set_temperature"), { dismissOnBackdrop: false });

      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0 4px;";

      const minus = roundButton("mdi:minus", card._t("rows.decrease_temperature"), () => change(-1));
      const plus = roundButton("mdi:plus", card._t("rows.increase_temperature"), () => change(1));

      const display = document.createElement("div");
      display.setAttribute("aria-live", "polite");
      display.style.cssText = "min-width:96px;text-align:center;font-size:1.5em;font-weight:500;" +
        "font-variant-numeric:tabular-nums;white-space:nowrap;";

      const refresh = () => {
        display.textContent = `${card._formatNumber1(target)} ${unit}`;
        minus.setDisabled(min !== null && target <= min);
        plus.setDisabled(max !== null && target >= max);
      };

      const change = (direction) => {
        let next = Math.round((target + direction * extra.step) / extra.step) * extra.step;
        next = Math.round(next * 100) / 100;

        if (min !== null) next = Math.max(min, next);
        if (max !== null) next = Math.min(max, next);

        target = next;
        refresh();
      };

      row.append(minus, display, plus);

      const confirm = textButton(card._t("rows.confirm"), () => {
        closePopup();

        if (target !== original) {
          card._callService("climate", "set_temperature", { entity_id: extra.entity, temperature: target });
        }
      }, true);

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:12px;";
      actions.append(textButton(card._t("rows.cancel"), closePopup), confirm);

      dialog.append(row, actions);
      refresh();
      confirm.focus();
    };

    const update = () => {
      const state = card._getState(extra.entity);
      const attrs = state?.attributes || {};
      const available = isAvailable(state);

      name.textContent = extra.name || attrs.friendly_name || extra.entity;

      // Tweede regel: status en voorinstelling, gescheiden door "·" (zoals de waarden van het hoofditem).
      // De voorinstelling "none" (geen) wordt niet getoond.
      const presetMode = attrs.preset_mode;
      const showPreset = available && typeof presetMode === "string" && presetMode !== "" &&
        presetMode.toLowerCase() !== "none";

      status.textContent = state
        ? [card._stateText(state), showPreset ? presetLabel(state, presetMode) : null].filter(Boolean).join(" · ")
        : NO_VALUE;

      info.el.setAttribute("aria-label", card._t("rows.more_info", { name: name.textContent }));
      preset.el.setAttribute("aria-label", card._t("rows.climate_preset"));
      info.setIcon(extra.icon || CLIMATE_ICONS[state?.state] || "mdi:thermostat");

      // Kleur volgens wat het toestel nu doet (hvac_action, anders de ingestelde modus)
      const action = climateAction(state, helpers);

      info.el.classList.toggle("heating", action === "heating");
      info.el.classList.toggle("cooling", action === "cooling");

      const current = toNumber(attrs.temperature);
      const unit = card._hass?.config?.unit_system?.temperature || "°C";

      value.textContent = current === null ? NO_VALUE : `${card._formatNumber1(current)} ${unit}`;
      value.disabled = !available || current === null;
      value.style.cursor = value.disabled ? "default" : "pointer";
      value.setAttribute("aria-label", card._t("rows.climate_set_temperature"));

      // Zonder voorinstellingen op het toestel is de knop verborgen; onbeschikbaar = uitgeschakeld
      const hasPresets = Array.isArray(attrs.preset_modes) && attrs.preset_modes.length > 0;

      preset.el.hidden = available && !hasPresets;
      preset.el.disabled = !available || !hasPresets;
    };

    const dispose = () => {
      disposeLongPress();
      closePopup();
    };

    return { el, update, dispose };
  };

  (window.CustomRowsExtras ??= new Map()).set("climate", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon, // optioneel: overschrijft het icoon van de knop
        step: Number(extra.step) > 0 ? Number(extra.step) : DEFAULT_STEP
      };
    },
    // Statusbadge op het hoofdicoon van de regel: verwarmen of koelen
    statusBadge(card, extra, helpers) {
      const action = climateAction(card._getState(extra.entity), helpers);

      if (action === "heating") return { icon: "mdi:heat-wave", tone: "heat" };
      if (action === "cooling") return { icon: "mdi:snowflake", tone: "cool" };

      return null;
    },
    build: buildClimate
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
