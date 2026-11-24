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

    // Icoon (more-info) | naam boven status | - temperatuur +
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

    // Voorinstelling (preset_mode) kiezen in een pop-up; staat direct links van de min-knop
    const preset = card._iconButton(() => openPresetPopup());
    preset.setIcon("mdi:air-filter");

    const minus = card._iconButton(() => change(-1));
    minus.setIcon("mdi:minus");

    const value = document.createElement("div");
    value.className = "stepper-value";

    const plus = card._iconButton(() => change(1));
    plus.setIcon("mdi:plus");

    stepper.append(preset.el, minus.el, value, plus.el);
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

    // Snel achter elkaar klikken: de gekozen waarde wordt direct getoond en na een
    // korte pauze in één keer doorgegeven aan Home Assistant.
    const control = { pending: null, sendTimer: null, clearTimer: null, disposed: false };

    const attributes = () => card._getState(extra.entity)?.attributes || {};

    const change = (direction) => {
      const attrs = attributes();
      const base = control.pending ?? toNumber(attrs.temperature);

      if (base === null) return;

      let next = Math.round((base + direction * extra.step) / extra.step) * extra.step;
      next = Math.round(next * 100) / 100;

      const min = toNumber(attrs.min_temp);
      const max = toNumber(attrs.max_temp);

      if (min !== null) next = Math.max(min, next);
      if (max !== null) next = Math.min(max, next);

      control.pending = next;
      clearTimeout(control.clearTimer);
      clearTimeout(control.sendTimer);
      update();

      control.sendTimer = setTimeout(async () => {
        control.sendTimer = null;
        const target = control.pending;

        await card._callService("climate", "set_temperature", {
          entity_id: extra.entity,
          temperature: target
        });

        if (control.disposed) return;
        // Even wachten tot de nieuwe status binnen is, daarna volgt het label de entiteit weer
        control.clearTimer = setTimeout(() => {
          control.pending = null;
          update();
        }, 1500);
      }, 600);
    };

    // Pop-up met een dropdown van de beschikbare voorinstellingen. Staat op document.body (buiten
    // de kaart), daarom is de opmaak inline en gebruikt die alleen de thema-variabelen van Home Assistant.
    let popup = null;

    const closePopup = () => {
      if (!popup) return;

      document.removeEventListener("keydown", popup.onKey, true);
      popup.backdrop.remove();
      popup = null;
    };

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

      closePopup();

      const title = card._t("rows.climate_preset");

      const backdrop = document.createElement("div");
      backdrop.style.cssText = "position:fixed;inset:0;z-index:1000;display:flex;align-items:center;" +
        "justify-content:center;box-sizing:border-box;padding:16px;background:rgba(0,0,0,0.5);" +
        "font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif);";

      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", title);
      dialog.style.cssText = "box-sizing:border-box;width:100%;max-width:360px;padding:16px 20px;" +
        "border-radius:var(--ha-card-border-radius, 12px);" +
        "background:var(--ha-card-background, var(--card-background-color, #fff));" +
        "color:var(--primary-text-color);box-shadow:0 8px 32px rgba(0,0,0,0.35);";

      const heading = document.createElement("div");
      heading.textContent = extra.name || state.attributes?.friendly_name || extra.entity;
      heading.style.cssText = "font-size:1.2em;font-weight:500;overflow-wrap:anywhere;";

      const sub = document.createElement("div");
      sub.textContent = title;
      sub.style.cssText = "margin:2px 0 12px;color:var(--secondary-text-color);";

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

      const close = document.createElement("button");
      close.type = "button";
      close.textContent = card._t("rows.close");
      close.style.cssText = "display:block;margin:12px 0 0 auto;padding:8px 12px;font:inherit;border:0;" +
        "border-radius:8px;background:transparent;color:var(--primary-color);cursor:pointer;";
      close.addEventListener("click", closePopup);

      dialog.append(heading, sub, select, close);
      backdrop.append(dialog);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closePopup();
      });

      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        closePopup();
      };

      document.addEventListener("keydown", onKey, true);
      document.body.append(backdrop);
      popup = { backdrop, onKey };
      select.focus();
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
      minus.el.setAttribute("aria-label", card._t("rows.decrease_temperature"));
      plus.el.setAttribute("aria-label", card._t("rows.increase_temperature"));
      info.setIcon(extra.icon || CLIMATE_ICONS[state?.state] || "mdi:thermostat");

      // Kleur volgens wat het toestel nu doet (hvac_action, anders de ingestelde modus)
      const action = climateAction(state, helpers);

      info.el.classList.toggle("heating", action === "heating");
      info.el.classList.toggle("cooling", action === "cooling");

      const current = control.pending ?? toNumber(attrs.temperature);
      const unit = card._hass?.config?.unit_system?.temperature || "°C";

      value.textContent = current === null ? NO_VALUE : `${card._formatNumber1(current)} ${unit}`;

      const min = toNumber(attrs.min_temp);
      const max = toNumber(attrs.max_temp);

      // Zonder voorinstellingen op het toestel is de knop verborgen; onbeschikbaar = uitgeschakeld
      const hasPresets = Array.isArray(attrs.preset_modes) && attrs.preset_modes.length > 0;

      preset.el.hidden = available && !hasPresets;
      preset.el.disabled = !available || !hasPresets;
      minus.el.disabled = !available || current === null || (min !== null && current <= min);
      plus.el.disabled = !available || current === null || (max !== null && current >= max);
    };

    const dispose = () => {
      disposeLongPress();
      closePopup();
      control.disposed = true;
      clearTimeout(control.clearTimer);
      if (control.sendTimer) {
        clearTimeout(control.sendTimer);
        control.sendTimer = null;
        card._callService("climate", "set_temperature", { entity_id: extra.entity, temperature: control.pending });
      }
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
